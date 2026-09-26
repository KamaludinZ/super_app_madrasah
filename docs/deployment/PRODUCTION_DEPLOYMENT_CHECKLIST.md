# 🚀 Production Deployment Checklist - Super Apps MATSANDATAMA
**Target Platform:** Coolify (Docker-based deployment)
**Last Updated:** 2 Agustus 2026

---

## ⚠️ CRITICAL - DO THESE FIRST

### 1. Security Verification

- [ ] **Verify `.env` files are NOT in Git repository**
  ```bash
  git ls-files | grep "\.env$"
  # Should return nothing (empty)
  ```

- [ ] **Confirm `.env` is in `.gitignore`**
  ```bash
  grep -r "^\.env$" .gitignore
  # Should show: .env
  ```

- [ ] **Generate NEW strong JWT secret for production**
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(64))"
  # Copy output and save securely for Coolify env vars
  ```

- [ ] **Prepare MongoDB Atlas Production Cluster**
  - Create production cluster (separate from development)
  - Configure IP whitelist (allow Coolify server IP)
  - Create database user with strong password
  - Enable audit logging
  - Configure automated backups

---

## 🔧 Pre-Deployment Configuration

### 2. Environment Variables Setup in Coolify

#### Backend Service Environment Variables

Set these in Coolify Dashboard > Your Backend Service > Environment:

```env
# Database
MONGO_URL=mongodb+srv://PROD_USERNAME:STRONG_PASSWORD@prod-cluster.mongodb.net/
DB_NAME=super_app_madrasah

# Security - CRITICAL!
JWT_SECRET=<paste-your-64-char-secret-here>
JWT_ALGORITHM=HS256

# Environment
ENVIRONMENT=production

# CORS - CRITICAL! Replace with your actual domains
CORS_ORIGINS=https://app.matsandatama.sch.id,https://api.matsandatama.sch.id

# Service URLs (Coolify auto-populates these usually)
SERVICE_URL_BACKEND=https://api.your-domain.com
SERVICE_URL_FRONTEND=https://app.your-domain.com

# Auto-update (DISABLE for production stability)
AUTO_UPDATE_ENABLED=false
```

**DO NOT SET:**
- Do NOT use development/local MongoDB
- Do NOT use default JWT secrets
- Do NOT use `CORS_ORIGINS=*`
- Do NOT enable AUTO_UPDATE in production

#### Frontend Service Build Arguments

Set these in Coolify Dashboard > Your Frontend Service > Build > Arguments:

```env
REACT_APP_BACKEND_URL=""
```
*Leave empty to use same domain, or specify full API URL if different domain*

#### Frontend Service Environment Variables

Set these in Coolify Dashboard > Your Frontend Service > Environment:

```env
BACKEND_UPSTREAM=https://api.your-domain.com/api/
```

---

### 3. Domain & DNS Configuration

- [ ] **Configure domains in Coolify**
  - Frontend: `app.your-domain.com` or `www.your-domain.com`
  - Backend: `api.your-domain.com`

- [ ] **Verify DNS records are pointing to Coolify server**
  ```bash
  nslookup app.your-domain.com
  nslookup api.your-domain.com
  ```

- [ ] **Enable HTTPS/SSL in Coolify**
  - Coolify auto-provisions Let's Encrypt certificates
  - Verify "Force HTTPS" is enabled

---

### 4. Database Preparation

- [ ] **Backup development data (if needed)**
  ```bash
  # From development MongoDB
  mongodump --uri="mongodb+srv://..." --db=super_app_madrasah --out=backup_dev
  ```

- [ ] **Run seeders on production database (ONCE)**
  ```bash
  # SSH into backend container after first deployment
  docker exec -it <backend-container> bash
  python seed_all_data.py
  exit
  ```

- [ ] **Verify seed data in MongoDB Atlas**
  - Login to MongoDB Atlas
  - Browse Collections > Check users, settings, etc.

---

## 🐳 Deployment Process

### 5. Deploy to Coolify

#### A. Create Services in Coolify

1. **Create Backend Service**
   - Service Type: Dockerfile
   - Repository: Connect your GitHub repo
   - Branch: `main` (or your production branch)
   - Dockerfile Location: `backend/Dockerfile`
   - Build Context: `backend`
   - Port: 8000
   - Health Check: `/api/health`

2. **Create Frontend Service**
   - Service Type: Dockerfile
   - Repository: Same GitHub repo
   - Branch: `main`
   - Dockerfile Location: `frontend/Dockerfile`
   - Build Context: `frontend`
   - Port: 80
   - Build Arguments: `REACT_APP_BACKEND_URL=""`

#### B. Deploy

- [ ] **Deploy backend first**
  ```
  Coolify Dashboard > Backend Service > Deploy
  ```

- [ ] **Wait for backend health check to pass**
  - Monitor logs: Check for "Application startup complete"
  - Test: `curl https://api.your-domain.com/api/health`

- [ ] **Deploy frontend**
  ```
  Coolify Dashboard > Frontend Service > Deploy
  ```

- [ ] **Wait for frontend to be online**
  - Test: Visit `https://app.your-domain.com`

---

## ✅ Post-Deployment Verification

### 6. Functional Testing

- [ ] **Test login page loads**
  - Visit: `https://app.your-domain.com`
  - Verify: No console errors
  - Verify: CAPTCHA loads
  - Verify: Login form works

- [ ] **Test authentication flow**
  - Login with admin account
  - Verify: JWT token issued
  - Verify: Redirect to dashboard
  - Verify: Session timeout works

- [ ] **Test public pages**
  - `/public/monitoring` - Monitoring Jurnal
  - `/public/prestasi` - Prestasi
  - `/public/agenda` - Agenda
  - `/public/rkam` - RKAM & Keuangan

- [ ] **Test protected endpoints**
  - Try accessing `/api/admin/users` without token (should fail)
  - Login and access admin endpoints (should work)

- [ ] **Test file uploads (if applicable)**
  - Upload student photo
  - Upload documents
  - Verify files are stored

---

### 7. Security Verification

- [ ] **Verify security headers are present**
  ```bash
  curl -I https://api.your-domain.com/api/health
  ```

  Should see:
  ```
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; ...
  ```

- [ ] **Verify HTTPS is enforced**
  - Visit: `http://app.your-domain.com` (HTTP, not HTTPS)
  - Should: Redirect to HTTPS version

- [ ] **Test CORS is restricted**
  ```bash
  curl -H "Origin: https://malicious-site.com" \
       https://api.your-domain.com/api/health
  ```
  - Should: Not include `Access-Control-Allow-Origin: https://malicious-site.com`

- [ ] **Verify rate limiting works**
  ```bash
  # Try to login with wrong password 6 times
  for i in {1..6}; do
    curl -X POST https://api.your-domain.com/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"test","password":"wrong","captcha_id":"x","captcha_answer":1}'
  done
  ```
  - Should: Get locked out after 5 attempts

- [ ] **Test CAPTCHA is required**
  ```bash
  curl -X POST https://api.your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"test"}'
  ```
  - Should: Fail with captcha required error

---

### 8. Performance & Monitoring

- [ ] **Test response times**
  ```bash
  curl -w "@curl-format.txt" -o /dev/null -s https://api.your-domain.com/api/health
  ```

  Create `curl-format.txt`:
  ```
  time_namelookup: %{time_namelookup}s
  time_connect: %{time_connect}s
  time_total: %{time_total}s
  ```

  - Should: < 500ms for /api/health

- [ ] **Check Docker container logs**
  ```bash
  # In Coolify dashboard or via SSH
  docker logs <backend-container-name>
  docker logs <frontend-container-name>
  ```
  - Should: No critical errors
  - Should: See successful startup messages

- [ ] **Monitor resource usage**
  ```bash
  docker stats
  ```
  - Check CPU and memory usage
  - Backend: Should use < 512MB RAM normally
  - Frontend: Should use < 50MB RAM normally

---

### 9. Backup & Recovery

- [ ] **Configure MongoDB Atlas automatic backups**
  - Atlas Dashboard > Backup > Configure schedule
  - Recommended: Daily backups, 7-day retention

- [ ] **Test backup restore (on test database)**
  ```bash
  # Download backup from Atlas
  # Restore to test cluster
  mongorestore --uri="mongodb+srv://test-cluster..." --dir=backup
  ```

- [ ] **Document recovery procedures**
  - Create runbook for disaster recovery
  - Store in secure location (not in Git)

---

### 10. User Acceptance Testing (UAT)

- [ ] **Admin functions**
  - Create user
  - Edit user
  - Delete user
  - Manage settings
  - View audit logs

- [ ] **Teacher functions**
  - View schedule
  - Create journal entry
  - Upload materials
  - View student list

- [ ] **Student functions**
  - View schedule
  - View grades
  - View attendance

- [ ] **Public pages**
  - Monitoring is visible
  - Agenda loads correctly
  - Prestasi displays
  - RKAM data shows

---

## 🔍 Troubleshooting Common Issues

### Backend won't start

**Check:**
1. Environment variables are set correctly
2. MongoDB connection string is valid
3. MongoDB IP whitelist includes Coolify server IP
4. Check logs: `docker logs <container>`

### Frontend shows "Failed to fetch"

**Check:**
1. `BACKEND_UPSTREAM` is set correctly in frontend env
2. CORS_ORIGINS includes frontend domain
3. Backend is running and healthy
4. Network connectivity between containers

### "Invalid token" errors

**Check:**
1. JWT_SECRET is the same on backend
2. Clock sync on server (JWT exp is time-based)
3. Token not expired (12 hours default)

### Database connection errors

**Check:**
1. MongoDB Atlas IP whitelist
2. MongoDB credentials correct
3. Network connectivity from Coolify to MongoDB Atlas
4. Database name is correct

---

## 📊 Monitoring & Maintenance

### Daily Checks

- [ ] Check Coolify dashboard for container status
- [ ] Review error logs
- [ ] Monitor MongoDB Atlas metrics

### Weekly Checks

- [ ] Review audit logs for suspicious activity
- [ ] Check backup completion status
- [ ] Review performance metrics

### Monthly Checks

- [ ] Review and rotate JWT secrets (optional, but recommended)
- [ ] Update dependencies (npm audit fix, pip list --outdated)
- [ ] Review and update CORS origins if domains changed
- [ ] Test disaster recovery procedure

---

## 🆘 Emergency Contacts & Procedures

### Rollback Procedure

If deployment fails or critical issues found:

1. **Rollback in Coolify**
   ```
   Coolify Dashboard > Service > Deployments > Previous Deployment > Redeploy
   ```

2. **Restore database backup (if needed)**
   ```bash
   mongorestore --uri="..." --dir=backup_before_deploy
   ```

3. **Notify users** via agreed communication channel

### Critical Issue Response

1. **Stop affected service**
   ```
   Coolify Dashboard > Service > Stop
   ```

2. **Investigate logs**
   ```bash
   docker logs <container> --tail=100
   ```

3. **Fix issue** (code fix or config change)

4. **Redeploy** after verification

---

## ✅ Final Sign-Off

**Deployment completed by:** ___________________

**Date:** ___________________

**Verified by:** ___________________

**Production URL:** https://app.your-domain.com

**API URL:** https://api.your-domain.com

**All checks passed:** [ ] Yes  [ ] No

**Issues noted:** _________________________________________

---

## 📚 Additional Resources

- Coolify Documentation: https://coolify.io/docs
- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com
- FastAPI Documentation: https://fastapi.tiangolo.com
- React Documentation: https://react.dev

---

**REMEMBER:**
- Never commit `.env` files to Git
- Always use strong, unique secrets for production
- Enable HTTPS for all production services
- Monitor logs and metrics regularly
- Keep backups current and tested
- Document any configuration changes

**APLIKASI SUDAH SIAP UNTUK PRODUCTION DEPLOYMENT! 🎉**
