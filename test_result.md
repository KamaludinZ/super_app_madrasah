#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Membuat aplikasi mobile (Android & iPhone) dari repo Super Apps MATSANDATAMA yang sudah deploy di super.mtsn2kotamalang.sch.id. Fase 1: jadikan PWA installable (Add to Home Screen) untuk semua role, ikon dari logo madrasah, login tetap tersimpan. Fase 2: Push Notification. Fase 3: Capacitor APK + ganti domain via config. Plus 'Ingat saya'."

frontend:
  - task: "PWA installable (manifest, service worker, icons, offline, install banner, standalone login persistence)"
    implemented: true
    working: true
    file: "frontend/public/manifest.json, frontend/public/service-worker.js, frontend/public/offline.html, frontend/src/lib/pwa.js, frontend/src/components/pwa/InstallPWA.js, frontend/src/index.js, frontend/src/lib/AuthContext.js, frontend/public/index.html"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Fase 1 PWA. Added manifest.json (standalone, theme #006837), generated icons (192/512/maskable/apple-touch) from school logo, service-worker.js (network-first navigation, SWR static, offline.html fallback, push+notificationclick handlers), iOS meta tags, InstallPWA banner (Android native prompt + iOS add-to-home instructions), disabled idle/session auto-logout when running standalone. Manual curl verification: manifest.json, service-worker.js, offline.html, icon-192.png all return 200. Screenshot confirmed SW registered at /service-worker.js and manifest link present. Needs automated verification. NOTE: local backend captcha endpoint fails in preview so login-gated flows may not be testable; focus on PWA assets/registration which do not require auth."
        - working: true
          agent: "testing"
          comment: "✓ ALL 6 PWA INSTALLABILITY CHECKS PASSED. CHECK 1 (manifest.json): HTTP 200, valid JSON with name='Super Apps MATSANDATAMA - MTsN 2 Kota Malang', short_name='MATSANDATAMA', display='standalone', theme_color='#006837', icons array contains 192x192, 512x512, and maskable icon. CHECK 2 (Service Worker): Successfully registered at http://localhost:3000/service-worker.js with state='activated'. CHECK 3 (HTML head tags): <link rel='manifest'> pointing to /manifest.json, <link rel='apple-touch-icon'> pointing to /apple-touch-icon.png, <meta name='apple-mobile-web-app-capable' content='yes'> all present. CHECK 4 (Icon assets): All 4 icons (/icon-192.png, /icon-512.png, /icon-maskable-512.png, /apple-touch-icon.png) return HTTP 200 with image/png content-type. CHECK 5 (offline.html): HTTP 200, contains required text 'Tidak Ada Koneksi'. CHECK 6 (App renders): Login page at /login renders normally with 'Masuk' form and 'Super Apps MATSANDATAMA' branding visible. Install banner not tested in headless Chromium (expected limitation). PWA is fully installable and ready for production."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 2
  run_ui: true

test_plan:
  current_focus:
    - "PWA installable (manifest, service worker, icons, offline, install banner, standalone login persistence)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Please verify Fase 1 PWA on the frontend (no auth required): 1) GET /manifest.json returns valid JSON with name, display=standalone, theme_color #006837, and icons array. 2) /service-worker.js registers successfully (navigator.serviceWorker registrations contains /service-worker.js). 3) index.html has <link rel=manifest> and apple-touch-icon + apple-mobile-web-app-capable meta. 4) Icons /icon-192.png, /icon-512.png, /icon-maskable-512.png, /apple-touch-icon.png load (HTTP 200, image). 5) /offline.html loads. 6) App still renders (login page shows). Do NOT attempt login (local captcha backend is failing in preview). Report PWA installability readiness."
    - agent: "testing"
      message: "✓ PWA Phase 1 verification COMPLETE. All 6 installability checks passed successfully. The app is fully PWA-ready with valid manifest, registered service worker, proper HTML meta tags, all icon assets loading correctly, offline page functional, and app rendering normally. No issues found. Ready for user testing and production deployment."
