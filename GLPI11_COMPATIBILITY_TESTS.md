# GLPI 11 Compatibility Tests - Carbooking Plugin

## Overview
Este documento descreve os testes necessários para validar que o plugin carbooking funciona corretamente em GLPI 11, com foco na sincronização instantânea de permissões.

---

## 1. Test Environment Setup

### Prerequisites
- GLPI 11.0.0 ou superior instalado
- Plugin carbooking instalado e ativado
- Acesso admin (Super-Admin)
- Pelo menos 2 usuários de teste: um admin e um com perfil limitado
- Navegador com Developer Tools para inspeção de rede

### Initial Checks
- [ ] Plugin carbooking visível em Administração > Plugins
- [ ] Hook `item_update` registrado para Profile
- [ ] Tabelas `glpi_plugin_carbooking_cars` e `glpi_plugin_carbooking_bookings` existem
- [ ] Direitos `carbooking::booking` e `carbooking::car` aparecem em Administração > Perfis

---

## 2. Profile Matrix Display (UI Test)

### Test 2.1: Permission Matrix Renders Correctly
**Steps:**
1. Log in as Super-Admin
2. Go to Administração > Perfis
3. Edit a test profile (or create a new one)
4. Look for "Agendamento de Carros" tab

**Expected Result:**
- [ ] Tab appears with "Agendamento de Carros" heading
- [ ] Matrix shows 2 rows: "Carros" and "Agendamentos"
- [ ] Each row has checkboxes for READ, UPDATE, CREATE, DELETE, PURGE
- [ ] "Agendamentos" row has additional APPROVE checkbox

### Test 2.2: Permissions Can Be Modified
**Steps:**
1. In the same Profile form
2. Check various permission combinations:
   - [ ] Check only READ for Carros
   - [ ] Check READ + CREATE for Agendamentos
   - [ ] Check READ + UPDATE + APPROVE for Agendamentos
3. Click "Salvar" (Save) button

**Expected Result:**
- [ ] Form submits successfully (HTTP 200)
- [ ] No error messages appear
- [ ] Profile is saved

---

## 3. POST Data Capture (GLPI 11 POST Format)

### Test 3.1: Verify POST Key Format
**Steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Edit a Profile and modify permissions
4. Click Save
5. Inspect the POST request to `profile.form.php`

**Expected Result:**
- [ ] POST payload contains `_rights` key (not `rights`)
- [ ] Value is JSON or array format:
  ```
  _rights[carbooking::booking] = 7  (bitmask for READ + UPDATE + CREATE)
  _rights[carbooking::car] = 1      (bitmask for READ only)
  ```
- [ ] `id` parameter contains profile ID

### Test 3.2: Test with Hook Debug Logging
**Steps:**
1. Enable GLPI file logging (check `files/log/` directory permissions)
2. Edit a Profile and change carbooking permissions
3. Save the form
4. Check `files/log/carbooking-*.log` file

**Expected Result:**
- [ ] Log entry appears with message like: "GLPI 11: Perfil 5 sincronizado com sucesso."
- [ ] Log entry contains profile ID that was updated
- [ ] Timestamp is recent (within seconds of form submission)

---

## 4. Database Persistence (GLPI 11 DB API Test)

### Test 4.1: Verify Data Persists to glpi_profilerights
**Steps:**
1. Log in as Super-Admin
2. Edit a Profile (e.g., ID = 5)
3. Set: Carros = READ (1), Agendamentos = READ + CREATE (5)
4. Click Save
5. Query the database directly:
   ```sql
   SELECT profiles_id, name, rights 
   FROM glpi_profilerights 
   WHERE profiles_id = 5 AND name LIKE 'carbooking::%';
   ```

**Expected Result:**
- [ ] 2 rows returned
- [ ] Row 1: `(5, 'carbooking::car', 1)`
- [ ] Row 2: `(5, 'carbooking::booking', 5)`
- [ ] No errors during query

### Test 4.2: Test updateOrInsert Fallback
**Steps:**
1. Create a new Profile (ID = 6)
2. Set carbooking permissions
3. Save form once → entries created (INSERT)
4. Modify permissions and save again → entries updated (UPDATE)
5. Repeat step 4 multiple times

**Expected Result:**
- [ ] Second and subsequent saves update existing rows (no duplicates)
- [ ] Count of rows for profile 6 stays at 2 (not increasing)
- [ ] Values change to reflect new permissions

---

## 5. Session Sync (Real-Time Permission Application)

### Test 5.1: Admin Updates Own Profile Session
**Steps:**
1. Log in as Super-Admin (session ID = 1 in dev, typically)
2. Have 2 browser windows open (same browser profile)
3. In Window A: Go to Administração > Perfis, edit Super-Admin profile
4. In Window A: Uncheck all carbooking permissions → Save
5. Check `front/debug_session.php`:
   - In Window A: Refresh the page immediately
   - In Window B: Try to access `front/agenda.php`

**Expected Result:**
- [ ] Window A debug_session.php shows no carbooking rights
- [ ] Window B agenda.php shows permission error or redirects to homepage
- [ ] Session was reloaded on save (Session Sync worked)

### Test 5.2: Admin Updates Another User's Profile
**Steps:**
1. Log in as Super-Admin (Window A)
2. Test User logs in with limited Carbooking permissions (Window B)
3. In Window A: Go to Administração > Perfis, edit Test User's profile
4. In Window A: Add APPROVE permission to carbooking::booking
5. In Window B: Refresh or access `front/debug_session.php`

**Expected Result:**
- [ ] Window B shows new APPROVE permission in session
- [ ] OR permission may not sync (if GLPI 11 doesn't auto-reload other sessions)
- [ ] Permission takes effect on next login or page refresh

### Test 5.3: Session Sync Logging
**Steps:**
1. Run Test 5.1 or 5.2
2. Check log file: `files/log/carbooking-*.log`

**Expected Result:**
- [ ] Log shows: "GLPI 11: Perfil [ID] sincronizado com sucesso."
- [ ] Log is created if ProfileRight::getProfileRights() is called

---

## 6. Helpdesk Interface Permission Checks

### Test 6.1: Helpdesk User Free Access
**Steps:**
1. Create a test user with Helpdesk interface only
2. Assign a profile with NO carbooking permissions
3. Log in as test Helpdesk user
4. Access `front/agenda.php`, `front/calendar.php`, `front/booking.form.php`

**Expected Result:**
- [ ] All pages load without 403 errors
- [ ] Pages show login-only access (no permission check)
- [ ] User can see their own bookings/cars

### Test 6.2: Central Interface Requires Permissions
**Steps:**
1. Create a test user with Central interface
2. Assign profile with NO carbooking permissions
3. Log in as test Central user
4. Try to access `front/booking.php` or `front/car.php`

**Expected Result:**
- [ ] Gets permission denied (403) or redirected
- [ ] Message: "You don't have permission to access carbooking::booking"

### Test 6.3: Central Interface with Permissions
**Steps:**
1. Same test user from 6.2
2. Edit their profile, add carbooking::booking READ permission
3. Try to access `front/booking.php` again

**Expected Result:**
- [ ] Page loads successfully (200)
- [ ] User can see bookings list

---

## 7. AJAX Endpoints Tests

### Test 7.1: Helpdesk AJAX Access
**Steps:**
1. Log in as Helpdesk user (no carbooking permissions)
2. Open DevTools Network tab
3. Access `front/calendar.php` or `front/agenda.php`
4. Observe XHR requests to `ajax/carsstatus.php` and `ajax/month.php`

**Expected Result:**
- [ ] AJAX requests return HTTP 200
- [ ] Response contains valid JSON with car status or month data
- [ ] No 403 Forbidden errors in console

### Test 7.2: Central AJAX with Permissions
**Steps:**
1. Log in as Central user WITH carbooking::booking READ permission
2. Access `front/agenda.php`
3. Observe XHR requests

**Expected Result:**
- [ ] AJAX requests return HTTP 200
- [ ] Response contains expected data

### Test 7.3: Central AJAX without Permissions
**Steps:**
1. Log in as Central user WITHOUT carbooking permissions
2. Try to access `front/agenda.php` directly via URL

**Expected Result:**
- [ ] Initial page load shows permission error (403 or redirect)
- [ ] AJAX requests don't execute

---

## 8. Granular Permission Checks (READ, CREATE, UPDATE, DELETE, APPROVE)

### Test 8.1: READ Permission
**Steps:**
1. Assign profile with only READ (1) on carbooking::booking
2. Access `front/booking.php`

**Expected Result:**
- [ ] Can view bookings list
- [ ] Cannot create new booking (button/form disabled or hidden)

### Test 8.2: CREATE Permission
**Steps:**
1. Assign profile with READ + CREATE on carbooking::booking
2. Access `front/booking.php`

**Expected Result:**
- [ ] Can view and create bookings
- [ ] Cannot approve bookings (if only CREATE, not APPROVE)

### Test 8.3: APPROVE Permission
**Steps:**
1. Assign profile with READ + APPROVE on carbooking::booking
2. Access `front/analytics.php` (requires APPROVE)

**Expected Result:**
- [ ] Page loads
- [ ] Analytics data visible

---

## 9. Edge Cases & Error Handling

### Test 9.1: Profile with No Carbooking Rights Entry
**Steps:**
1. Create a brand new profile
2. Don't assign any carbooking permissions
3. Try to access carbooking pages

**Expected Result:**
- [ ] Pages show permission denied (not 500 error)
- [ ] Log shows appropriate message

### Test 9.2: Profile Purge (Deletion)
**Steps:**
1. Create a test profile with carbooking permissions
2. Go to Administração > Perfis
3. Select test profile, click Delete/Purge

**Expected Result:**
- [ ] Profile deleted
- [ ] Entries in `glpi_profilerights` for this profile removed
- [ ] No orphaned rights in DB

### Test 9.3: Plugin Reinstall
**Steps:**
1. Uninstall plugin: Administração > Plugins, click Uninstall
2. Delete plugin folder
3. Re-download and install

**Expected Result:**
- [ ] Installation completes without errors
- [ ] Tables recreated
- [ ] Default rights created
- [ ] Super-Admin gets all carbooking permissions

---

## 10. Performance & Load Tests

### Test 10.1: Profile Save Response Time
**Steps:**
1. Edit a Profile with many other permissions
2. Modify carbooking permissions
3. Save and measure response time

**Expected Result:**
- [ ] Save completes within 2-3 seconds
- [ ] No timeout errors
- [ ] Log entries created

### Test 10.2: Multiple Profiles Edited
**Steps:**
1. Edit 5-10 profiles, adding/removing carbooking permissions
2. Monitor server resources
3. Check logs for any errors

**Expected Result:**
- [ ] All saves complete successfully
- [ ] No database locks or connection errors
- [ ] Log file grows appropriately (one entry per save)

---

## 11. Compatibility Checklist

- [ ] GLPI 11.0.0 verified (or specific version: _______)
- [ ] PHP version compatibility (8.0+): _____
- [ ] MariaDB/MySQL version: _____
- [ ] `updateOrInsert()` available on `$DB` object: YES / NO
- [ ] `ProfileRight::getProfileRights()` works correctly: YES / NO
- [ ] `$_POST['_rights']` format confirmed: YES / NO
- [ ] Session reload works for active user: YES / NO
- [ ] Helpdesk/Central interface split working: YES / NO

---

## 12. Troubleshooting

### Issue: POST data not captured
**Solution:**
- Check GLPI 11 form submission in DevTools
- Verify POST key is `_rights` not `rights`
- Log $_POST contents in hook for debugging

### Issue: updateOrInsert() not found
**Solution:**
- Fallback uses countElementsInTable + update/insert
- Should work on GLPI 10 and 11

### Issue: Session not syncing for other users
**Solution:**
- GLPI may require manual permission reload
- Test user needs to logout/login or refresh page

### Issue: 403 on AJAX endpoints
**Solution:**
- Check interface type (Helpdesk vs Central)
- Verify session login check passes
- Review Network tab for error message

---

## 13. Test Sign-Off

| Test # | Test Name | Status | Notes | Date |
|--------|-----------|--------|-------|------|
| 2.1    | Permission Matrix Display | [ ] PASS / [ ] FAIL | | |
| 2.2    | Permissions Modifiable | [ ] PASS / [ ] FAIL | | |
| 3.1    | POST Format Verified | [ ] PASS / [ ] FAIL | | |
| 3.2    | Hook Debug Logging | [ ] PASS / [ ] FAIL | | |
| 4.1    | DB Persistence | [ ] PASS / [ ] FAIL | | |
| 4.2    | updateOrInsert Fallback | [ ] PASS / [ ] FAIL | | |
| 5.1    | Admin Self Session Sync | [ ] PASS / [ ] FAIL | | |
| 5.2    | Admin Updates Other | [ ] PASS / [ ] FAIL | | |
| 5.3    | Session Sync Logging | [ ] PASS / [ ] FAIL | | |
| 6.1    | Helpdesk Free Access | [ ] PASS / [ ] FAIL | | |
| 6.2    | Central Permission Check | [ ] PASS / [ ] FAIL | | |
| 6.3    | Central with Permissions | [ ] PASS / [ ] FAIL | | |
| 7.1    | Helpdesk AJAX | [ ] PASS / [ ] FAIL | | |
| 7.2    | Central AJAX with Perms | [ ] PASS / [ ] FAIL | | |
| 7.3    | Central AJAX without Perms | [ ] PASS / [ ] FAIL | | |
| 8.1    | READ Permission | [ ] PASS / [ ] FAIL | | |
| 8.2    | CREATE Permission | [ ] PASS / [ ] FAIL | | |
| 8.3    | APPROVE Permission | [ ] PASS / [ ] FAIL | | |
| 9.1    | No Rights Entry | [ ] PASS / [ ] FAIL | | |
| 9.2    | Profile Purge | [ ] PASS / [ ] FAIL | | |
| 9.3    | Plugin Reinstall | [ ] PASS / [ ] FAIL | | |
| 10.1   | Response Time | [ ] PASS / [ ] FAIL | | |
| 10.2   | Load Test | [ ] PASS / [ ] FAIL | | |

---

## 14. Final Validation

**Overall Status:** [ ] ALL TESTS PASS / [ ] SOME FAILURES

**Recommendations:**
```
[Add any final notes, known issues, or improvements]
```

**Tested By:** ____________  
**Date:** ____________  
**GLPI Version:** ____________  
**Plugin Version:** ____________
