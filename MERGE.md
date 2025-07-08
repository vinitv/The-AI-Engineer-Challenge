# MERGE.md - Sales Research Assistant Feature

## 🎯 **Feature Overview**

This branch transforms the AI Chat Assistant into a **Sales Research Assistant** specifically designed for pre-sales engineers and sales representatives. The app now provides AI-powered customer research capabilities with interactive follow-up questions.

## 🚀 **Key Features Added**

### **Backend Enhancements**
- **Sales-focused RAG system** with specialized prompts for company analysis
- **Follow-up question generation** API endpoint
- **Enhanced document processing** with company name association
- **Improved context retrieval** (5 chunks instead of 3)

### **Frontend Transformations**
- **Sales Research UI** with building icons and professional design
- **Company document upload** with name association
- **Interactive follow-up questions** that appear after each AI response
- **Enhanced error handling** and user feedback

### **New API Endpoints**
- `POST /api/generate_followup` - Generates contextual follow-up questions
- Enhanced `POST /api/upload` - Now requires company name
- Enhanced `POST /api/rag_chat` - Sales-focused analysis

## 📋 **Testing Files Added**
- `test_company.pdf` - Sample company document for testing
- `test_sales_research.py` - Comprehensive test script

## 🔧 **Technical Changes**

### **Files Modified**
- `api/app.py` - Complete backend transformation
- `frontend/app/page.tsx` - Complete frontend transformation
- `vercel.json` - Updated for production deployment

### **New Dependencies**
- All existing dependencies maintained
- No new dependencies required

## 📦 **Deployment Instructions**

### **Local Development**
1. **Backend**: `cd api && PYTHONPATH=.. uvicorn app:app --reload --port 8000`
2. **Frontend**: `cd frontend && npm run dev`
3. **Test**: Open http://localhost:3000

### **Production Deployment**
The app is ready for Vercel deployment with the updated `vercel.json` configuration.

## 🔄 **Merge Instructions**

### **Option 1: GitHub Pull Request (Recommended)**

1. **Create Pull Request**:
   ```bash
   # Navigate to GitHub and create PR from:
   # sales-research-tool → main
   ```

2. **Review Changes**:
   - Backend: Sales-focused prompts and follow-up generation
   - Frontend: Complete UI transformation
   - Configuration: Updated Vercel settings

3. **Merge to Main**:
   ```bash
   git checkout main
   git pull origin main
   git merge sales-research-tool
   git push origin main
   ```

### **Option 2: Direct Merge (GitHub CLI)**

```bash
# Create and merge pull request
gh pr create --title "Sales Research Assistant Feature" --body "Transform app into sales research tool with follow-up questions"
gh pr merge --merge --delete-branch
```

### **Option 3: Local Merge**

```bash
# Switch to main branch
git checkout main

# Merge the feature branch
git merge sales-research-tool

# Push to remote
git push origin main

# Clean up (optional)
git branch -d sales-research-tool
git push origin --delete sales-research-tool
```

## 🧪 **Testing After Merge**

### **Manual Testing**
1. **Upload Test Document**:
   - Company: "Acme Corporation"
   - File: `test_company.pdf`

2. **Test Questions**:
   - "What are Acme Corporation's main business challenges?"
   - "Who are the key decision makers?"
   - "What is their technology stack?"

3. **Verify Features**:
   - ✅ Sales-focused UI appears
   - ✅ Document uploads successfully
   - ✅ AI provides sales insights
   - ✅ Follow-up questions appear
   - ✅ Clicking follow-up questions works

### **Automated Testing**
```bash
# Update API key in test script
python test_sales_research.py
```

## 🎯 **Use Cases**

### **Pre-sales Research**
- Upload prospect 10-K reports
- Analyze business challenges
- Identify decision makers
- Understand technology stack

### **Competitive Analysis**
- Research competitor documents
- Identify market opportunities
- Understand competitive landscape

### **Sales Intelligence**
- Generate follow-up questions
- Discover pain points
- Map stakeholder relationships

## 🚨 **Important Notes**

1. **API Key Required**: Users must provide OpenAI API key
2. **File Size Limit**: 10MB maximum for PDF uploads
3. **Production Ready**: All changes are production-ready
4. **Backward Compatible**: Existing chat functionality preserved

## 📞 **Support**

If issues arise during merge or deployment:
1. Check Vercel deployment logs
2. Verify API endpoints are responding
3. Test with the provided test files
4. Review browser console for frontend errors

---

**Branch**: `sales-research-tool`  
**Status**: Ready for merge  
**Deployment**: Production-ready 