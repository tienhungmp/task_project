"""
FastAPI Backend cho Task Management AI - OpenAI Version (Dynamic Labels + Project Creation)
Cài đặt: pip install fastapi uvicorn openai python-dotenv pydantic
Chạy: python backend_api.py
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import uvicorn
from datetime import datetime
import time
import os
from openai import OpenAI
import json
import uuid
from dotenv import load_dotenv

load_dotenv()

# ==================== CONFIGURATION ====================
class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    MODEL = "gpt-4o-mini"
    TEMPERATURE = 0
    MAX_RETRIES = 3
    TIMEOUT = 30
    MAX_BATCH_SIZE = 50
    
    EXAMPLE_PROJECTS = [
        "Dự án Web",
        "Dự án Mobile", 
        "Marketing",
        "Nghiên cứu",
        "Cá nhân"
    ]
    
    EXAMPLE_TOPICS = [
        "Phát triển",
        "Thiết kế",
        "Quản lý",
        "Nghiên cứu",
        "Học tập",
        "Giao tiếp"
    ]


# ==================== MODELS ====================
class TaskExtracted(BaseModel):
    """Model cho 1 task được trích xuất"""
    task_id: str
    task_text: str
    estimated_time_minutes: int = Field(gt=0, description="Thời gian ước tính (phút)")
    priority: str = Field(pattern="^(Low|Medium|High)$")
    suggested_project: str
    suggested_topic: str
    
    @validator('task_text')
    def validate_task_text(cls, v):
        words = v.strip().split()
        if len(words) < 6:
            raise ValueError(f"Task phải có ít nhất 6 từ, hiện tại: {len(words)}")
        return v


class NoteRequest(BaseModel):
    """Request model"""
    text: str = Field(..., min_length=10, description="Nội dung ghi chú cần phân tích")
    user_id: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Tuần này cần hoàn thành báo cáo Q4 trước thứ 6, gửi email cho 50 khách hàng về sản phẩm mới",
                "user_id": "user_123"
            }
        }


class ProjectCreationRequest(BaseModel):
    """Request để tạo project mới kèm tasks"""
    project_description: str = Field(..., min_length=20, description="Mô tả chi tiết về dự án cần tạo")
    user_id: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "project_description": "Tạo một website bán hàng online cho shop quần áo. Cần có trang chủ, trang sản phẩm, giỏ hàng và thanh toán. Dự kiến hoàn thành trong 3 tháng.",
                "user_id": "user_123"
            }
        }


class ProjectInfo(BaseModel):
    """Thông tin project được AI đề xuất"""
    name: str = Field(..., min_length=3, max_length=100)
    description: str
    estimated_duration_days: int = Field(gt=0, description="Thời gian ước tính (ngày)")
    priority: str = Field(pattern="^(Low|Medium|High)$")
    suggested_area: str = Field(..., description="Area gợi ý cho project")
    color: int = Field(ge=0, le=10, description="Màu đề xuất (0-10)")
    icon: int = Field(ge=0, le=50, description="Icon đề xuất (0-50)")
    energy_level: str = Field(pattern="^(low|medium|high|urgent)$")


class TaskForProject(BaseModel):
    """Task cho project creation"""
    task_text: str
    estimated_time_minutes: int = Field(gt=0)
    priority: str = Field(pattern="^(Low|Medium|High)$")
    status: str = Field(pattern="^(todo|doing|done|pending)$", default="todo")
    energy_level: str = Field(pattern="^(low|medium|high|urgent)$")
    suggested_topic: str
    order: int = Field(ge=1, description="Thứ tự thực hiện")


class ProjectCreationResponse(BaseModel):
    """Response khi tạo project"""
    success: bool
    project: ProjectInfo
    tasks: List[TaskForProject]
    metadata: Dict[str, Any]
    processing_time_ms: float


class TaskResponse(BaseModel):
    """Response cho 1 task"""
    task_id: str
    task_text: str
    estimated_time_minutes: int
    priority: str
    suggested_project: str
    suggested_topic: str
    created_at: str


class AnalysisResponse(BaseModel):
    """Response tổng thể"""
    success: bool
    tasks: List[TaskResponse]
    metadata: Dict[str, Any]
    processing_time_ms: float


class BatchNoteRequest(BaseModel):
    """Request cho batch analysis"""
    notes: List[NoteRequest] = Field(..., max_items=50)


class ErrorResponse(BaseModel):
    """Error response model"""
    success: bool = False
    error: str
    detail: Optional[str] = None


class FolderSuggestionRequest(BaseModel):
    """Request để gợi ý folder"""
    text: str = Field(..., min_length=10, description="Nội dung note cần phân loại")
    user_folders: List[Dict[str, str]] = Field(..., description="Danh sách folders hiện có của user")
    user_id: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Cần học Python cơ bản về vòng lặp và hàm",
                "user_folders": [
                    {"_id": "folder1", "name": "Học lập trình"},
                    {"_id": "folder2", "name": "Công việc"},
                    {"_id": "folder3", "name": "Sức khỏe"}
                ],
                "user_id": "user_123"
            }
        }


class FolderSuggestionResponse(BaseModel):
    """Response cho folder suggestion"""
    success: bool
    found_match: bool
    suggested_folder: Optional[Dict[str, Any]] = None
    confidence: float = Field(ge=0, le=1, description="Độ tin cậy (0-1)")
    reasoning: str
    all_scores: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    processing_time_ms: float    


# ==================== OPENAI SERVICE ====================
class OpenAITaskAnalyzer:
    """Service xử lý AI với OpenAI"""
    
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required")
        self.client = OpenAI(api_key=api_key)
        self.model = Config.MODEL
        self.temperature = Config.TEMPERATURE
    
    def _construct_system_prompt(self) -> str:
        """Tạo system prompt cho OpenAI - không giới hạn danh sách"""
        return f"""Bạn là một AI chuyên gia phân tích ghi chú tiếng Việt và trích xuất danh sách công việc cụ thể.

QUY TẮC NGHIÊM NGẶT BẮT BUỘC:
1. Mỗi task PHẢI là một câu tiếng Việt hoàn chỉnh, rõ ràng, có nghĩa
2. Mỗi task PHẢI chứa động từ hành động cụ thể (làm, viết, gửi, kiểm tra, cập nhật, tạo, hoàn thành, v.v.)
3. Mỗi task PHẢI có ít nhất 6 từ tiếng Việt
4. Mỗi task chỉ đại diện cho MỘT đơn vị công việc duy nhất, không được gộp nhiều việc
5. TUYỆT ĐỐI KHÔNG tách task chỉ dựa vào dấu phẩy
6. TUYỆT ĐỐI KHÔNG xuất ra từ khóa, cụm từ rời rạc, hay câu chưa hoàn chỉnh
7. NẾU ghi chú ngụ ý các bước bị thiếu (ví dụ: "làm báo cáo" cần có bước thu thập dữ liệu trước), hãy tạo thêm các task cần thiết

8. Ước tính thời gian hoàn thành (phút) một cách thực tế dựa trên độ phức tạp:
   - Task đơn giản: 15-30 phút
   - Task trung bình: 30-90 phút
   - Task phức tạp: 90-240 phút

9. Phân loại mức độ ưu tiên:
   - High: Có deadline cụ thể hoặc từ khóa "gấp", "khẩn", "quan trọng"
   - Medium: Cần làm trong tuần/tháng
   - Low: Không có deadline rõ ràng

10. ĐỀ XUẤT DỰ ÁN (suggested_project):
   - TỰ DO sáng tạo tên dự án phù hợp với nội dung task
   - Dựa vào ngữ cảnh để đặt tên dự án có ý nghĩa (ví dụ: "Báo cáo Q4", "Email Marketing", "Phát triển Website ABC")
   - Các task liên quan nên được gom vào cùng 1 dự án
   - Dự án nên ngắn gọn (2-4 từ) nhưng đầy đủ ý nghĩa
   - Ví dụ tốt: "Website Bán Hàng", "Marketing Sản Phẩm X", "Học Python", "Báo Cáo Quý 4"
   - Tránh: "Dự án 1", "Công việc", "Task"

11. ĐỀ XUẤT CHỦ ĐỀ (suggested_topic):
   - TỰ DO sáng tạo chủ đề phù hợp với bản chất công việc
   - Phân loại theo tính chất/lĩnh vực của task (không phải theo dự án)
   - Chủ đề nên là danh từ chung (1-2 từ) mô tả loại công việc
   - Ví dụ tốt: "Lập Trình", "Viết Báo Cáo", "Email Marketing", "Họp Team", "Nghiên Cứu", "Thiết Kế UI"
   - Tránh: chủ đề quá chung ("Công việc") hoặc quá chi tiết ("Viết email cho khách hàng VIP về sản phẩm mới")

QUAN TRỌNG: 
- Chỉ xuất ra JSON hợp lệ, KHÔNG có markdown, KHÔNG có text thừa
- Mỗi task_text phải là câu hoàn chỉnh có thể đọc hiểu ngay
- Tên dự án và chủ đề phải có ý nghĩa, dễ hiểu, phù hợp với ngữ cảnh Việt Nam
- Hãy sáng tạo nhưng hợp lý - đặt tên sao cho người dùng dễ quản lý và tìm kiếm sau này"""

    def _construct_project_system_prompt(self) -> str:
        """System prompt cho việc tạo project"""
        return """Bạn là AI chuyên gia lập kế hoạch dự án, phân tích yêu cầu và tạo danh sách công việc chi tiết.

NHIỆM VỤ:
1. Phân tích mô tả dự án và tạo thông tin project hoàn chỉnh
2. Chia nhỏ dự án thành các task cụ thể, rõ ràng, có thứ tự logic
3. Ước tính thời gian và độ ưu tiên cho từng task

QUY TẮC CHO PROJECT INFO:
- name: Tên ngắn gọn (2-5 từ), dễ nhớ
- description: Mô tả chi tiết mục tiêu và phạm vi dự án
- estimated_duration_days: Ước tính tổng thời gian (ngày) dựa trên tổng task
- priority: High/Medium/Low dựa trên tính cấp thiết
- suggested_area: Đề xuất Area phù hợp (ví dụ: "Công việc", "Cá nhân", "Học tập", "Sức khỏe")
- color: Số từ 0-10 đại diện màu sắc
- icon: Số từ 0-50 đại diện icon
- energy_level: low/medium/high/urgent

QUY TẮC CHO TASKS:
- Mỗi task là câu hoàn chỉnh, rõ ràng (tối thiểu 6 từ)
- Có động từ hành động cụ thể
- Sắp xếp theo thứ tự logic (order: 1, 2, 3...)
- status: mặc định "todo" (có thể: todo/doing/done/pending)
- energy_level: low/medium/high/urgent
- priority: High/Medium/Low
- suggested_topic: Chủ đề của task (ví dụ: "Thiết kế", "Lập trình", "Nghiên cứu")
- estimated_time_minutes: Thời gian ước tính cho task (15-240 phút)

QUAN TRỌNG:
- Tạo ít nhất 5-15 tasks tùy phạm vi dự án
- Tasks phải bao phủ toàn bộ quy trình từ đầu đến cuối
- Chỉ xuất JSON hợp lệ, KHÔNG có markdown"""

    def _construct_user_prompt(self, note_text: str) -> str:
        """Tạo user prompt"""
        return f"""Phân tích ghi chú sau đây và trích xuất tất cả các công việc cần làm.
Nếu có các bước ngầm định (ví dụ: "gửi báo cáo" cần có bước "viết báo cáo" trước), hãy tạo thêm các task đó.

GHI CHÚ:
{note_text}

HÃY TỰ DO ĐỀ XUẤT tên dự án (suggested_project) và chủ đề (suggested_topic) PHÙ HỢP nhất cho từng task.
Không bị giới hạn bởi bất kỳ danh sách nào - hãy sáng tạo dựa trên nội dung thực tế.

Xuất ra JSON theo đúng định dạng sau (KHÔNG thêm markdown):
{{
  "success": true,
  "tasks": [
    {{
      "task_id": "uuid-string",
      "task_text": "Câu tiếng Việt hoàn chỉnh mô tả công việc cụ thể cần làm",
      "estimated_time_minutes": 45,
      "priority": "Medium",
      "suggested_project": "Tên dự án bạn tự đề xuất - ngắn gọn, có ý nghĩa",
      "suggested_topic": "Tên chủ đề bạn tự đề xuất - mô tả loại công việc"
    }}
  ]
}}"""

    def _construct_project_user_prompt(self, project_description: str) -> str:
        """User prompt cho project creation"""
        return f"""Dựa trên mô tả dự án sau, hãy tạo:
1. Thông tin project đầy đủ
2. Danh sách tasks chi tiết để hoàn thành dự án

MÔ TẢ DỰ ÁN:
{project_description}

Xuất ra JSON theo format (KHÔNG có markdown):
{{
  "success": true,
  "project": {{
    "name": "Tên dự án ngắn gọn",
    "description": "Mô tả chi tiết",
    "estimated_duration_days": 30,
    "priority": "High",
    "suggested_area": "Tên Area phù hợp",
    "color": 5,
    "icon": 10,
    "energy_level": "medium"
  }},
  "tasks": [
    {{
      "task_text": "Task đầy đủ ít nhất 6 từ",
      "estimated_time_minutes": 60,
      "priority": "High",
      "status": "todo",
      "energy_level": "medium",
      "suggested_topic": "Chủ đề",
      "order": 1
    }}
  ]
}}"""

    def _validate_and_clean_response(self, content: str) -> dict:
        """Validate và clean response từ OpenAI"""
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON response: {e}")
        
        if not isinstance(data, dict):
            raise ValueError("Response must be a JSON object")
        
        if not data.get("success"):
            raise ValueError("Response success field must be true")
        
        if "tasks" not in data or not isinstance(data["tasks"], list):
            raise ValueError("Response must contain 'tasks' array")
        
        validated_tasks = []
        for idx, task in enumerate(data["tasks"]):
            if "task_id" not in task or not task["task_id"]:
                task["task_id"] = str(uuid.uuid4())
            
            try:
                validated_task = TaskExtracted(**task)
                validated_tasks.append(validated_task.dict())
            except Exception as e:
                raise ValueError(f"Task {idx + 1} validation failed: {e}")
        
        data["tasks"] = validated_tasks
        return data

    def _validate_project_response(self, content: str) -> dict:
        """Validate response cho project creation"""
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON response: {e}")
        
        if not isinstance(data, dict):
            raise ValueError("Response must be a JSON object")
        
        if not data.get("success"):
            raise ValueError("Response success field must be true")
        
        # Validate project info
        if "project" not in data:
            raise ValueError("Response must contain 'project' object")
        
        try:
            validated_project = ProjectInfo(**data["project"])
        except Exception as e:
            raise ValueError(f"Project validation failed: {e}")
        
        # Validate tasks
        if "tasks" not in data or not isinstance(data["tasks"], list):
            raise ValueError("Response must contain 'tasks' array")
        
        if len(data["tasks"]) < 3:
            raise ValueError("Project must have at least 3 tasks")
        
        validated_tasks = []
        for idx, task in enumerate(data["tasks"]):
            try:
                validated_task = TaskForProject(**task)
                validated_tasks.append(validated_task.dict())
            except Exception as e:
                raise ValueError(f"Task {idx + 1} validation failed: {e}")
        
        data["project"] = validated_project.dict()
        data["tasks"] = validated_tasks
        return data

    def analyze(self, note_text: str, retries: int = Config.MAX_RETRIES) -> dict:
        """Phân tích note và trích xuất tasks"""
        system_prompt = self._construct_system_prompt()
        user_prompt = self._construct_user_prompt(note_text)
        
        last_error = None
        
        for attempt in range(1, retries + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    temperature=self.temperature,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    timeout=Config.TIMEOUT
                )
                
                content = response.choices[0].message.content
                result = self._validate_and_clean_response(content)
                
                projects = list(set(task['suggested_project'] for task in result['tasks']))
                topics = list(set(task['suggested_topic'] for task in result['tasks']))
                
                result["metadata"] = {
                    "model": self.model,
                    "tokens_used": response.usage.total_tokens,
                    "note_length": len(note_text),
                    "tasks_extracted": len(result["tasks"]),
                    "projects_discovered": projects,
                    "topics_discovered": topics,
                    "attempt": attempt
                }
                
                return result
                
            except Exception as e:
                last_error = e
                if attempt < retries:
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                    continue
        
        raise Exception(f"Failed after {retries} attempts. Last error: {last_error}")

    def create_project(self, project_description: str, retries: int = Config.MAX_RETRIES) -> dict:
        """Tạo project mới với AI"""
        system_prompt = self._construct_project_system_prompt()
        user_prompt = self._construct_project_user_prompt(project_description)
        
        last_error = None
        
        for attempt in range(1, retries + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    temperature=self.temperature,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    timeout=Config.TIMEOUT
                )
                
                content = response.choices[0].message.content
                result = self._validate_project_response(content)
                
                # Extract unique topics
                topics = list(set(task['suggested_topic'] for task in result['tasks']))
                
                result["metadata"] = {
                    "model": self.model,
                    "tokens_used": response.usage.total_tokens,
                    "description_length": len(project_description),
                    "tasks_created": len(result["tasks"]),
                    "topics_discovered": topics,
                    "attempt": attempt
                }
                
                return result
                
            except Exception as e:
                last_error = e
                if attempt < retries:
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                    continue
        
        raise Exception(f"Failed after {retries} attempts. Last error: {last_error}")

    def _construct_folder_suggestion_prompt(self, text: str, folders: List[Dict]) -> str:
        """System prompt cho folder suggestion"""
        folder_list = "\n".join([f"- {f['name']}" for f in folders])
        
        return f"""Bạn là AI chuyên gia phân loại nội dung tiếng Việt vào các thư mục (folders).

    NHIỆM VỤ:
    Phân tích nội dung note và tìm folder PHÙ HỢP NHẤT trong danh sách cho sẵn.

    DANH SÁCH FOLDERS HIỆN CÓ:
    {folder_list}

    QUY TẮC:
    1. So sánh nội dung note với TÊN của từng folder
    2. Tìm folder có tên KHỚP NHẤT về chủ đề/lĩnh vực
    3. Nếu KHÔNG có folder nào phù hợp (confidence < 0.6), trả về found_match = false
    4. Chỉ đề xuất folder khi THỰC SỰ có sự liên quan rõ ràng

    CHI TIẾT PHÂN TÍCH:
    - Trích xuất chủ đề chính của note
    - So sánh với ý nghĩa/phạm vi của tên folder
    - Tính điểm phù hợp (0-1) cho MỖI folder
    - Chọn folder có điểm cao nhất (nếu >= 0.6)

    QUAN TRỌNG:
    - Chỉ xuất JSON hợp lệ, KHÔNG có markdown
    - Phải giải thích rõ ràng lý do chọn/không chọn
    - Liệt kê điểm số của TẤT CẢ folders để người dùng hiểu

    Format JSON output:
    {{
    "success": true,
    "found_match": true/false,
    "suggested_folder_name": "Tên folder được chọn" hoặc null,
    "confidence": 0.85,
    "reasoning": "Giải thích chi tiết tại sao chọn folder này hoặc tại sao không tìm thấy",
    "all_scores": [
        {{
        "folder_name": "Tên folder",
        "score": 0.85,
        "reason": "Lý do cụ thể"
        }}
    ]
    }}"""

    def suggest_folder(self, text: str, folders: List[Dict], retries: int = Config.MAX_RETRIES) -> dict:
        """Gợi ý folder phù hợp cho note"""
        if not folders or len(folders) == 0:
            return {
                "success": True,
                "found_match": False,
                "suggested_folder_name": None,
                "confidence": 0.0,
                "reasoning": "Không có folder nào để so sánh",
                "all_scores": []
            }
        
        system_prompt = self._construct_folder_suggestion_prompt(text, folders)
        user_prompt = f"""NỘI DUNG NOTE:
    {text}

    Hãy phân tích và đề xuất folder phù hợp nhất từ danh sách trên."""
        
        last_error = None
        
        for attempt in range(1, retries + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    temperature=0.3,  # Tăng một chút để linh hoạt hơn
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    timeout=Config.TIMEOUT
                )
                
                content = response.choices[0].message.content
                
                # Clean markdown
                content = content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
                
                result = json.loads(content)
                
                # Validate response
                if not isinstance(result, dict):
                    raise ValueError("Response must be a JSON object")
                
                if "found_match" not in result:
                    raise ValueError("Response must contain 'found_match' field")
                
                # Add metadata
                result["metadata"] = {
                    "model": self.model,
                    "tokens_used": response.usage.total_tokens,
                    "text_length": len(text),
                    "folders_analyzed": len(folders),
                    "attempt": attempt
                }
                
                return result
                
            except Exception as e:
                last_error = e
                if attempt < retries:
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                    continue
        
        raise Exception(f"Failed after {retries} attempts. Last error: {last_error}")

# ==================== FASTAPI APP ====================
app = FastAPI(
    title="Task Management AI API (Dynamic + Project Creation)",
    description="Tự động trích xuất tasks và tạo projects với AI",
    version="2.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer: Optional[OpenAITaskAnalyzer] = None


# ==================== STARTUP ====================
@app.on_event("startup")
async def startup():
    global analyzer
    print("🚀 Starting Task Management AI Server (Dynamic + Project Creation)...")
    
    try:
        api_key = Config.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required")
        
        analyzer = OpenAITaskAnalyzer(api_key=api_key)
        print(f"✅ OpenAI service initialized (Model: {Config.MODEL})")
        print(f"✅ Server ready at http://0.0.0.0:8000")
        print(f"✅ API docs at http://0.0.0.0:8000/docs")
        print(f"✨ Features: Dynamic labels + Project creation!")
        
    except Exception as e:
        print(f"❌ Failed to initialize: {e}")
        raise


# ==================== DEPENDENCIES ====================
async def get_analyzer() -> OpenAITaskAnalyzer:
    if analyzer is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    return analyzer


# ==================== ENDPOINTS ====================

@app.get("/")
async def root():
    return {
        "service": "Task Management AI (Dynamic + Project Creation)",
        "version": "2.2.0",
        "status": "running",
        "model": Config.MODEL,
        "initialized": analyzer is not None,
        "features": ["dynamic_labels", "project_creation"],
        "docs": "/docs"
    }


@app.get("/health")
async def health(analyzer: OpenAITaskAnalyzer = Depends(get_analyzer)):
    return {
        "status": "healthy",
        "service": "openai",
        "model": Config.MODEL,
        "features": ["dynamic_projects", "dynamic_topics", "project_creation"],
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_note(
    request: NoteRequest,
    analyzer: OpenAITaskAnalyzer = Depends(get_analyzer)
):
    """
    Phân tích ghi chú và trích xuất tasks
    AI tự động đề xuất projects và topics
    """
    start_time = time.time()
    
    try:
        result = analyzer.analyze(note_text=request.text)
        
        tasks = []
        for task_data in result['tasks']:
            tasks.append(TaskResponse(
                task_id=task_data['task_id'],
                task_text=task_data['task_text'],
                estimated_time_minutes=task_data['estimated_time_minutes'],
                priority=task_data['priority'],
                suggested_project=task_data['suggested_project'],
                suggested_topic=task_data['suggested_topic'],
                created_at=datetime.utcnow().isoformat()
            ))
        
        processing_time = (time.time() - start_time) * 1000
        
        metadata = result['metadata']
        metadata.update({
            "user_id": request.user_id,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        return AnalysisResponse(
            success=True,
            tasks=tasks,
            metadata=metadata,
            processing_time_ms=round(processing_time, 2)
        )
    
    except Exception as e:
        print(f"❌ Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/suggest-folder", response_model=FolderSuggestionResponse)
async def suggest_folder_for_note(
    request: FolderSuggestionRequest,
    analyzer: OpenAITaskAnalyzer = Depends(get_analyzer)
):
    """
    GỢI Ý FOLDER PHÙ HỢP CHO NOTE
    
    AI sẽ:
    - Phân tích nội dung note
    - So sánh với tên các folders hiện có
    - Đề xuất folder phù hợp nhất
    - Trả về "không tìm thấy" nếu không có folder phù hợp (confidence < 0.6)
    
    Example:
```
    POST /api/suggest-folder
    {
        "text": "Cần học Python về list và dictionary",
        "user_folders": [
            {"_id": "f1", "name": "Học lập trình"},
            {"_id": "f2", "name": "Công việc"}
        ]
    }
```
    """
    start_time = time.time()
    
    try:
        result = analyzer.suggest_folder(
            text=request.text,
            folders=request.user_folders
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        # Tìm folder object từ tên
        suggested_folder = None
        if result.get("found_match") and result.get("suggested_folder_name"):
            folder_name = result["suggested_folder_name"]
            for folder in request.user_folders:
                if folder["name"] == folder_name:
                    suggested_folder = folder
                    break
        
        metadata = result.get("metadata", {})
        metadata.update({
            "user_id": request.user_id,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        return FolderSuggestionResponse(
            success=result.get("success", True),
            found_match=result.get("found_match", False),
            suggested_folder=suggested_folder,
            confidence=result.get("confidence", 0.0),
            reasoning=result.get("reasoning", ""),
            all_scores=result.get("all_scores", []),
            metadata=metadata,
            processing_time_ms=round(processing_time, 2)
        )
    
    except Exception as e:
        print(f"❌ Folder suggestion error: {e}")
        raise HTTPException(status_code=500, detail=f"Folder suggestion failed: {str(e)}")
    
@app.post("/api/create-project", response_model=ProjectCreationResponse)
async def create_project(
    request: ProjectCreationRequest,
    analyzer: OpenAITaskAnalyzer = Depends(get_analyzer)
):
    """
    TẠO PROJECT MỚI với AI
    
    AI sẽ:
    - Phân tích mô tả dự án
    - Tạo thông tin project (name, description, area, timeline, etc.)
    - Tạo danh sách tasks chi tiết có thứ tự
    
    Example:
    ```
    POST /api/create-project
    {
        "project_description": "Xây dựng website bán hàng cho shop quần áo...",
        "user_id": "user_123"
    }
    ```
    """
    start_time = time.time()
    
    try:
        result = analyzer.create_project(project_description=request.project_description)
        
        processing_time = (time.time() - start_time) * 1000
        
        metadata = result['metadata']
        metadata.update({
            "user_id": request.user_id,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        return ProjectCreationResponse(
            success=True,
            project=ProjectInfo(**result['project']),
            tasks=[TaskForProject(**task) for task in result['tasks']],
            metadata=metadata,
            processing_time_ms=round(processing_time, 2)
        )
    
    except Exception as e:
        print(f"❌ Project creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Project creation failed: {str(e)}")


@app.post("/api/batch-analyze")
async def batch_analyze(
    request: BatchNoteRequest,
    analyzer: OpenAITaskAnalyzer = Depends(get_analyzer)
):
    """Phân tích nhiều notes cùng lúc"""
    if len(request.notes) > Config.MAX_BATCH_SIZE:
        raise HTTPException(status_code=400, detail=f"Maximum {Config.MAX_BATCH_SIZE} notes per batch")
    
    results = []
    for idx, note in enumerate(request.notes):
        try:
            result = analyzer.analyze(note_text=note.text)
            results.append({
                "index": idx,
                "success": True,
                "note_text": note.text[:100] + "..." if len(note.text) > 100 else note.text,
                "tasks_count": len(result['tasks']),
                "projects_discovered": result['metadata']['projects_discovered'],
                "topics_discovered": result['metadata']['topics_discovered'],
                "tasks": result['tasks']
            })
        except Exception as e:
            results.append({
                "index": idx,
                "success": False,
                "note_text": note.text[:100] + "..." if len(note.text) > 100 else note.text,
                "error": str(e)
            })
    
    successful = sum(1 for r in results if r['success'])
    failed = len(results) - successful
    
    return {
        "total": len(request.notes),
        "successful": successful,
        "failed": failed,
        "results": results
    }


@app.get("/api/config")
async def get_config():
    return {
        "model": Config.MODEL,
        "max_batch_size": Config.MAX_BATCH_SIZE,
        "features": {
            "dynamic_projects": True,
            "dynamic_topics": True,
            "project_creation": True,
            "description": "AI tự động đề xuất + Tạo projects với tasks"
        }
    }


@app.get("/api/labels")
async def get_labels():
    return {
        "priority": ["Low", "Medium", "High"],
        "status": ["todo", "doing", "done", "pending"],
        "energy_level": ["low", "medium", "high", "urgent"],
        "projects": "AI tự động đề xuất",
        "topics": "AI tự động đề xuất"
    }


# ==================== ERROR HANDLERS ====================
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "success": False,
        "error": exc.detail,
        "status_code": exc.status_code
    }


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    print(f"❌ Unhandled error: {exc}")
    return {
        "success": False,
        "error": "Internal server error",
        "detail": str(exc)
    }


# ==================== RUN SERVER ====================
if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════╗
║   Task Management AI - Project Creation Feature          ║
║   Tạo projects + tasks tự động với AI                    ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "backend_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )