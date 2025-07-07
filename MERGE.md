# 🚀 How to Merge Feature Branches into `main`

Welcome! This guide will help you merge any feature branch (like new PDF upload, RAG chat, or other cool features) into your `main` branch. Follow these steps for a smooth, drama-free merge!

---

## 🏆 Recommended: GitHub Pull Request (PR)

1. **Push your feature branch to GitHub:**
   ```sh
   git push origin <feature-branch-name>
   ```
2. **Open your repository on GitHub.**
3. **Click "Compare & pull request"** for your feature branch.
4. **Review the changes.**
5. **Request reviews** if needed.
6. **Click "Merge pull request"** to merge into `main`.
7. *(Optional)* **Delete the feature branch** after merging.

---

## 💻 Alternative: GitHub CLI (`gh`)

1. **Push your feature branch to GitHub:**
   ```sh
   git push origin <feature-branch-name>
   ```
2. **Create a pull request from the CLI:**
   ```sh
   gh pr create --base main --head <feature-branch-name> \
     --title "<Feature Title>" \
     --body "<Feature Description>"
   ```
3. **Merge the pull request from the CLI:**
   ```sh
   gh pr merge --merge
   ```

---

## 🔄 After Merging

- **Update your local `main` branch:**
  ```sh
  git checkout main
  git pull origin main
  ```
- *(Optional)* **Delete your local feature branch:**
  ```sh
  git branch -d <feature-branch-name>
  ```

---

🎉 **That's it! Your new feature is now live in `main`. Go build something awesome!** 