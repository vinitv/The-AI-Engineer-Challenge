# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional, List
from aimakerspace import vectordatabase, text_utils
import tempfile
import uuid
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
import asyncio
import json

# Initialize FastAPI application with a title
app = FastAPI(title="Sales Research AI Assistant")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# File size limits (in bytes)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB limit for Vercel Edge Runtime

# Sales-focused system prompts
SALES_SYSTEM_PROMPT = """You are an expert sales research assistant helping pre-sales engineers and sales representatives analyze potential customers. Your role is to:

1. Analyze company documents (10-K reports, financial statements, press releases, etc.) to identify:
   - Company size, revenue, growth trends
   - Key business challenges and pain points
   - Technology stack and infrastructure
   - Decision makers and organizational structure
   - Competitive landscape and market position
   - Recent news, acquisitions, or strategic initiatives

2. Provide actionable insights for sales conversations including:
   - Potential use cases for your products/services
   - Pain points that your solution could address
   - Key stakeholders to engage with
   - Competitive advantages and differentiators
   - Risk factors and challenges to be aware of

3. Generate 3-4 relevant follow-up questions that would help deepen the research and identify sales opportunities.

Always be professional, accurate, and focus on insights that would be valuable for sales conversations."""

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

class RAGChatRequest(BaseModel):
    doc_id: str
    user_message: str
    developer_message: Optional[str] = SALES_SYSTEM_PROMPT
    model: Optional[str] = "gpt-4.1-mini"
    api_key: str

# In-memory store for indexed documents (for demo purposes)
doc_store = {}  # doc_id -> {"chunks": List[str], "api_key": str, "company_name": str}

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(...), company_name: str = Form(...)):
    """
    Upload a company document (PDF), extract and chunk text, store in memory.
    Returns a document ID for future research queries.
    """
    # Enhanced file validation
    if not file:
        raise HTTPException(status_code=400, detail="No file provided.")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")
    
    # Check file extension (case-insensitive)
    filename_lower = file.filename.lower()
    if not filename_lower.endswith('.pdf'):
        raise HTTPException(
            status_code=400, 
            detail=f"Only PDF files are supported. Received: {file.filename} (type: {file.content_type})"
        )
    
    # Check content type
    if file.content_type and file.content_type not in ['application/pdf', 'application/octet-stream']:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid content type. Expected PDF, got: {file.content_type}"
        )
    
    try:
        # Read file content with size validation
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty.")
        
        # Check file size
        file_size = len(file_content)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB. Your file is {file_size // (1024*1024)}MB."
            )
        
        # Save uploaded file to a temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        # Extract text from PDF
        loader = PDFLoader(tmp_path)
        documents = loader.load_documents()  # List[str]
        
        if not documents:
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")
        
        splitter = CharacterTextSplitter()
        chunks = splitter.split_texts(documents)  # List[str]
        
        if not chunks:
            raise HTTPException(status_code=400, detail="No text chunks could be created from the PDF.")
        
        # Store chunks, API key, and company name in memory (no embeddings yet)
        doc_id = str(uuid.uuid4())
        doc_store[doc_id] = {
            "chunks": chunks, 
            "api_key": api_key, 
            "company_name": company_name,
            "filename": file.filename
        }
        
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except:
            pass  # Ignore cleanup errors
        
        return {
            "doc_id": doc_id, 
            "chunks_count": len(chunks),
            "company_name": company_name,
            "filename": file.filename
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the error for debugging
        print(f"PDF upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

@app.post("/api/rag_chat")
async def rag_chat(request: RAGChatRequest):
    """
    Research a company using uploaded documents with sales-focused analysis and follow-up questions.
    """
    doc_data = doc_store.get(request.doc_id)
    if doc_data is None:
        raise HTTPException(status_code=404, detail="Document not found. Please upload and index the PDF first.")
    
    # Create embeddings on-demand for RAG
    try:
        # Set environment variable for the embedding model
        os.environ["OPENAI_API_KEY"] = doc_data["api_key"]
        
        # Create vector database with embeddings
        db = vectordatabase.VectorDatabase()
        db = await db.abuild_from_list(doc_data["chunks"])
        
        # Retrieve relevant context from the PDF
        top_k = 5  # Increased for better context
        results = db.search_by_text(request.user_message, k=top_k, return_as_text=True)
        context_text = "\n".join(results)  # type: ignore - results is List[str] when return_as_text=True
        
        # Compose sales-focused prompt
        prompt = f"""{request.developer_message}

Company: {doc_data['company_name']}
Document: {doc_data['filename']}

Context from company documents:
{context_text}

User question: {request.user_message}

Please provide a comprehensive analysis and then generate 3-4 relevant follow-up questions that would help with sales research. Format your response as:

ANALYSIS:
[Your detailed analysis here]

FOLLOW_UP_QUESTIONS:
1. [First follow-up question]
2. [Second follow-up question]
3. [Third follow-up question]
4. [Fourth follow-up question]"""
        
        client = OpenAI(api_key=doc_data["api_key"])
        model_name = request.model if request.model else "gpt-4.1-mini"
        stream = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": prompt},
            ],
            stream=True
        )
        async def generate():
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate_followup")
async def generate_followup_questions(request: RAGChatRequest):
    """
    Generate follow-up questions based on the current conversation context.
    """
    doc_data = doc_store.get(request.doc_id)
    if doc_data is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    try:
        client = OpenAI(api_key=doc_data["api_key"])
        model_name = request.model if request.model else "gpt-4.1-mini"
        
        prompt = f"""Based on the user's question about {doc_data['company_name']}: "{request.user_message}"

Generate 4 relevant follow-up questions that would help with sales research. Focus on:
- Understanding their business challenges
- Identifying decision makers and stakeholders
- Exploring their technology needs
- Understanding their competitive landscape
- Finding potential use cases for your solutions

Format as a JSON array of strings:
["Question 1", "Question 2", "Question 3", "Question 4"]"""
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": prompt},
            ],
            temperature=0.7
        )
        
        # Parse the response to extract questions
        content = response.choices[0].message.content
        if not content:
            return {"questions": []}
            
        try:
            # Try to parse as JSON
            questions = json.loads(content)
            if isinstance(questions, list):
                return {"questions": questions}
        except:
            # If JSON parsing fails, extract questions manually
            lines = content.split('\n')
            questions = []
            for line in lines:
                line = line.strip()
                if line and (line.startswith('"') or line.startswith('-') or line.startswith('•')):
                    # Clean up the question
                    question = line.lstrip('"-•').rstrip('",').strip()
                    if question and len(question) > 10:
                        questions.append(question)
            
            return {"questions": questions[:4]}  # Return max 4 questions
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            model_name = request.model if request.model else "gpt-4.1-mini"
            stream = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
