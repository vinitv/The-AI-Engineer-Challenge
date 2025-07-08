#!/usr/bin/env python3
"""
Test script for Sales Research Assistant
Tests the backend API endpoints with a sample company document
"""

import requests
import json
import os

# Configuration
API_BASE = "http://localhost:8000"
TEST_PDF_PATH = "test_company.pdf"
API_KEY = "your-openai-api-key-here"  # Replace with your actual API key

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    response = requests.get(f"{API_BASE}/api/health")
    if response.status_code == 200:
        print("✅ Health check passed")
        return True
    else:
        print(f"❌ Health check failed: {response.status_code}")
        return False

def test_upload_document():
    """Test document upload endpoint"""
    print("\n📄 Testing document upload...")
    
    if not os.path.exists(TEST_PDF_PATH):
        print(f"❌ Test PDF not found: {TEST_PDF_PATH}")
        return None
    
    with open(TEST_PDF_PATH, 'rb') as f:
        files = {'file': ('test_company.pdf', f, 'application/pdf')}
        data = {
            'api_key': API_KEY,
            'company_name': 'Acme Corporation'
        }
        
        response = requests.post(f"{API_BASE}/api/upload", files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Document uploaded successfully")
            print(f"   Company: {result['company_name']}")
            print(f"   Document ID: {result['doc_id']}")
            print(f"   Chunks: {result['chunks_count']}")
            return result['doc_id']
        else:
            print(f"❌ Upload failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

def test_rag_chat(doc_id):
    """Test RAG chat with follow-up questions"""
    print("\n💬 Testing RAG chat...")
    
    test_questions = [
        "What are the main business challenges facing Acme Corporation?",
        "Who are the key decision makers at the company?",
        "What is their technology stack and infrastructure?",
        "What are their growth plans and strategic initiatives?"
    ]
    
    for question in test_questions:
        print(f"\n🤔 Question: {question}")
        
        data = {
            'doc_id': doc_id,
            'user_message': question,
            'api_key': API_KEY,
            'model': 'gpt-4.1-mini'
        }
        
        response = requests.post(f"{API_BASE}/api/rag_chat", json=data)
        
        if response.status_code == 200:
            content = response.text
            print(f"✅ Response received ({len(content)} characters)")
            
            # Check if response contains follow-up questions
            if "FOLLOW_UP_QUESTIONS:" in content:
                print("✅ Follow-up questions detected in response")
            else:
                print("⚠️  No follow-up questions found in response")
                
            # Show first 200 characters of response
            preview = content[:200] + "..." if len(content) > 200 else content
            print(f"   Preview: {preview}")
        else:
            print(f"❌ RAG chat failed: {response.status_code}")
            print(f"   Response: {response.text}")

def test_followup_generation(doc_id):
    """Test follow-up question generation"""
    print("\n💡 Testing follow-up question generation...")
    
    data = {
        'doc_id': doc_id,
        'user_message': "What are Acme Corporation's main business challenges?",
        'api_key': API_KEY,
        'model': 'gpt-4.1-mini'
    }
    
    response = requests.post(f"{API_BASE}/api/generate_followup", json=data)
    
    if response.status_code == 200:
        result = response.json()
        questions = result.get('questions', [])
        print(f"✅ Generated {len(questions)} follow-up questions:")
        for i, question in enumerate(questions, 1):
            print(f"   {i}. {question}")
    else:
        print(f"❌ Follow-up generation failed: {response.status_code}")
        print(f"   Response: {response.text}")

def main():
    """Run all tests"""
    print("🚀 Starting Sales Research Assistant Tests")
    print("=" * 50)
    
    # Check if API key is set
    if API_KEY == "your-openai-api-key-here":
        print("⚠️  Please set your OpenAI API key in the script")
        print("   Edit the API_KEY variable in test_sales_research.py")
        return
    
    # Run tests
    if not test_health_check():
        return
    
    doc_id = test_upload_document()
    if doc_id:
        test_rag_chat(doc_id)
        test_followup_generation(doc_id)
    
    print("\n" + "=" * 50)
    print("🏁 Tests completed!")

if __name__ == "__main__":
    main() 