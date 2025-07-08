#!/usr/bin/env python3
"""
Test script to debug PDF upload issues
"""
import requests
import os
import tempfile

def test_upload():
    # Replace with your actual Vercel app URL
    base_url = "https://your-app-name.vercel.app"  # Replace this!
    
    # Test health endpoint first
    try:
        health_response = requests.get(f"{base_url}/api/health")
        print(f"Health check: {health_response.status_code} - {health_response.text}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return
    
    # Create a simple test PDF (or use an existing one)
    test_pdf_path = "test.pdf"
    
    # Check if test PDF exists
    if not os.path.exists(test_pdf_path):
        print(f"Test PDF not found at {test_pdf_path}")
        print("Please create a simple PDF file or update the path")
        return
    
    # Test upload
    try:
        with open(test_pdf_path, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            data = {'api_key': 'your-api-key-here'}  # Replace with actual API key
            
            print("Testing upload...")
            response = requests.post(f"{base_url}/api/upload", files=files, data=data)
            
            print(f"Upload response: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"Upload successful! Doc ID: {result.get('doc_id')}")
            else:
                print(f"Upload failed with status {response.status_code}")
                
    except Exception as e:
        print(f"Upload test failed: {e}")

if __name__ == "__main__":
    print("PDF Upload Test Script")
    print("=" * 50)
    test_upload() 