# GLPI 11 Synchronization Flow - Technical Documentation

## Overview
This document explains how the carbooking plugin permission synchronization works in GLPI 11, with flow diagrams and technical details.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GLPI 11 Admin Dashboard                     │
│                                                                 │
│  Administração > Perfis > [Edit Profile] > Agendamento de Carros│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Profile Form Submission
                             │ POST /glpi/front/profile.form.php
                             │ Body: _rights[carbooking::booking]=7
                             │       _rights[carbooking::car]=1
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GLPI 11 Profile Handler                      │
│                                                                 │
│  profile.form.php processes form update                        │
│  Triggers: Profile::post_updateItem() hook                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Registered Hook
                             │ $PLUGIN_HOOKS['item_update']['carbooking']
                             │ = ['Profile' => 'plugin_carbooking_post_profile_update']
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      hook.php Handler                           │
│                                                                 │
│  plugin_carbooking_post_profile_update($item)                  │
│                                                                 │
│  1. Verify Profile instance                                   │
│  2. Extract profiles_id from $item->getField('id')            │
│  3. Capture POST['_rights'] → parse bitmasks                  │
│  4. For each right (carbooking::booking, carbooking::car):   │
│     - Read value from POST or DB                              │
│     - Use updateOrInsert() (GLPI 11) or fallback             │
│     - Persist to glpi_profilerights table                     │
│  5. If profile is active user's profile:                      │
│     - Reload session via ProfileRight::getProfileRights()    │
│     - Update $_SESSION['glpiactiveprofile']['rights']        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ glpi_profilerights   │
                  │ Updated Entry:       │
                  │ profiles_id: 5       │
                  │ name: carbooking::   │
                  │   booking            │
                  │ rights: 7            │
                  │ (READ|UPDATE|CREATE) │
                  └──────────────────────┘
                             │
                             │ Session Sync (if active user's profile)
                             ▼
                  ┌──────────────────────┐
                  │ $_SESSION[           │
                  │ 'glpiactiveprofile'] │
                  │ ['rights'][          │
                  │  'carbooking::       │
                  │   booking'] = 7      │
                  └──────────────────────┘
                             │
                             │ Next Page Request → User Has Updated Permissions
                             ▼
          ┌──────────────────────────────────────────┐
          │  front/*.php files use updated rights    │
          │  - agenda.php checks READ permission     │
          │  - analytics.php checks APPROVE          │
          │  - booking.form.php checks CREATE        │
          └──────────────────────────────────────────┘
```

---

## 2. Detailed State Flow - Admin Editing Active User's Own Profile

### Scenario
Admin (Super-Admin, profiles_id=1) logs in and edits their own profile to add carbooking permissions.

### Step-by-Step Execution

```
TIME=0: Admin loads profile.form.php
├─ Session: $_SESSION['glpiactiveprofile']['id'] = 1
└─ Session: $_SESSION['glpiactiveprofile']['rights'] = [...]

TIME=1: Admin checks carbooking::booking READ + UPDATE (bitmask=3)
│       and carbooking::car READ (bitmask=1)

TIME=2: Admin clicks Save
├─ POST Request fired to profile.form.php
├─ POST Parameters:
│  ├─ id=1 (profile ID)
│  ├─ _rights[carbooking::booking]=3
│  ├─ _rights[carbooking::car]=1
│  └─ ... (other form fields)
└─ GLPI Profile handler processes update

TIME=3: GLPI calls plugin_carbooking_post_profile_update()
├─ $item = Profile instance with id=1
├─ Extract profiles_id = 1
├─ Check POST['_rights']:
│  ├─ $_POST['_rights']['carbooking::booking'] = '3'
│  └─ $_POST['_rights']['carbooking::car'] = '1'
└─ rights_updated = false

TIME=4: Loop through rights (carbooking::booking, carbooking::car)
├─ Right #1: 'carbooking::booking'
│  ├─ $value = 3 (from POST)
│  ├─ Execute: $DB->updateOrInsert('glpi_profilerights',
│  │            ['profiles_id'=>1, 'name'=>'carbooking::booking', 'rights'=>3],
│  │            ['profiles_id'=>1, 'name'=>'carbooking::booking'])
│  └─ Result: Row updated in DB (or inserted if new)
│
└─ Right #2: 'carbooking::car'
   ├─ $value = 1 (from POST)
   ├─ Execute: $DB->updateOrInsert(...)
   └─ Result: Row updated in DB

TIME=5: Check Session Sync Conditions
├─ $rights_updated = true ✓
├─ isset($_SESSION['glpiactiveprofile']['id']) = true ✓
├─ (int)$_SESSION['glpiactiveprofile']['id'] = 1 ✓
├─ profiles_id = 1 ✓
└─ ALL conditions met → PROCEED WITH SESSION SYNC

TIME=6: Execute Session Sync
├─ Call: ProfileRight::getProfileRights(1)
│  └─ GLPI core function reads glpi_profilerights where profiles_id=1
│     and returns array like:
│     [
│       'carbooking::booking' => 3,
│       'carbooking::car' => 1,
│       ... (other profile rights)
│     ]
├─ Assign: $_SESSION['glpiactiveprofile']['rights'] = [new array]
├─ Check: if (isset(...['carbooking::booking']) || isset(...['carbooking::car']))
│  └─ At least one carbooking right exists
├─ Log: Toolbox::logInFile('carbooking', "GLPI 11: Perfil 1 sincronizado com sucesso.\n")
└─ Session now has NEW permissions

TIME=7: GLPI completes profile.form.php request
├─ HTTP Response: 302 Redirect or 200 Success
├─ Admin browser receives response
└─ Session established with updated permissions

TIME=8: Admin navigates to front/agenda.php
├─ Page load reads: $_SESSION['glpiactiveprofile']['rights']['carbooking::booking']
├─ Permission check: Session::checkRight('carbooking::booking', READ)
│  └─ Bitmask 3 & 1 (READ) = 1 ✓ SUCCESS
└─ Page renders agenda content (permission granted)

RESULT: ✓ Admin now has carbooking permissions instantly
        ✓ No logout/login required
        ✓ Session updated in real-time
```

---

## 3. State Flow - Admin Editing Another User's Profile

### Scenario
Admin edits TestUser's profile (profiles_id=5) to add carbooking permissions.  
TestUser is currently logged in on another session.

```
TIME=0: Admin loads TestUser's profile.form.php
├─ Admin Session: $_SESSION['glpiactiveprofile']['id'] = 1
└─ TestUser Session (separate): $_SESSION['glpiactiveprofile']['id'] = 5

TIME=1-2: Admin modifies permissions and saves
(Same as previous scenario, TIME=2)

TIME=3: GLPI calls plugin_carbooking_post_profile_update()
├─ $item->getField('id') = 5 (TestUser's profile)
└─ profiles_id = 5

TIME=4-5: Database updated (same process)
└─ glpi_profilerights rows updated for profiles_id=5

TIME=6: Session Sync Check
├─ $rights_updated = true ✓
├─ isset($_SESSION['glpiactiveprofile']['id']) = true ✓
├─ $_SESSION['glpiactiveprofile']['id'] = 1 (Admin's active profile)
├─ profiles_id = 5 (TestUser's profile being edited)
└─ 1 ≠ 5 → CONDITIONS NOT MET ✗

TIME=7: Session Sync Skipped
├─ Reason: Admin's active session is NOT TestUser's profile
├─ Admin's session doesn't have carbooking rights anyway
└─ No logging occurs

TIME=8: TestUser's Current Session
├─ Still has OLD permissions in $_SESSION['glpiactiveprofile']['rights']
├─ Database HAS new permissions (just updated)
└─ Mismatch until TestUser:
   ├─ Logs out and back in (reloads session)
   ├─ OR manually refreshes permissions
   ├─ OR GLPI auto-reloads on next page visit (GLPI 11 feature?)

RESULT: ⚠ TestUser still has old permissions in session
        ✓ Database has new permissions
        ✓ Next login/session reload will apply new permissions
```

**NOTE:** GLPI 11 may have session reload on page navigation or AJAX.  
Test: TestUser accesses front/debug_session.php to check if permissions are auto-updated.

---

## 4. Permission Bitmask Reference

### Standard GLPI Rights (bits 0-4)
```
READ    = 1   = 0b00001   (can view)
UPDATE  = 2   = 0b00010   (can edit)
CREATE  = 4   = 0b00100   (can create new)
DELETE  = 8   = 0b01000   (can delete)
PURGE   = 16  = 0b10000   (can purge/hard delete)

ALLSTANDARDRIGHT = 31 (0b11111 = READ+UPDATE+CREATE+DELETE+PURGE)
```

### Carbooking-Specific Rights (bit 10)
```
APPROVE = 1024 = 0b10000000000   (can approve bookings - Booking class constant)

For carbooking::booking:
  ALLSTANDARDRIGHT | APPROVE = 31 | 1024 = 1055
```

### Examples
```
3  = READ (1) + UPDATE (2)
5  = READ (1) + CREATE (4)
7  = READ (1) + UPDATE (2) + CREATE (4)
15 = READ (1) + UPDATE (2) + CREATE (4) + DELETE (8)
31 = ALLSTANDARDRIGHT (all except PURGE implicit)
39 = READ (1) + UPDATE (2) + CREATE (4) + DELETE (8) + PURGE (16) + APPROVE (1024) = 1055
     (This is wrong, should be 1055 for full carbooking::booking with APPROVE)
```

---

## 5. POST Data Format (GLPI 11)

### Form Submission
When admin saves a Profile with carbooking permissions, GLPI 11 sends:

```
POST /glpi/front/profile.form.php HTTP/1.1
Content-Type: application/x-www-form-urlencoded

id=5&_token=...&_rights[carbooking::booking]=7&_rights[carbooking::car]=1&update=1&...
```

### Parsed by PHP
```php
$_POST = [
    'id' => '5',
    '_token' => '...',
    '_rights' => [
        'carbooking::booking' => '7',
        'carbooking::car' => '1',
    ],
    'update' => '1',
    ... // other GLPI profile fields
];
```

### Code Extraction
```php
$post_rights = [];
if (!empty($_POST['_rights']) && is_array($_POST['_rights'])) {
    $post_rights = $_POST['_rights'];
    // Now $post_rights['carbooking::booking'] = '7' (string)
    // Convert to int: (int)'7' = 7 ✓
}
```

---

## 6. Database Operations Detail

### Step 1: Check If Entry Exists (Fallback)
```php
$exists = countElementsInTable('glpi_profilerights', [
    'profiles_id' => 5,
    'name' => 'carbooking::booking',
]);
// If exists = 1 → UPDATE, else INSERT
```

### Step 2: Use updateOrInsert (GLPI 11 Preferred)
```php
if (method_exists($DB, 'updateOrInsert')) {
    $DB->updateOrInsert(
        'glpi_profilerights',
        [
            'profiles_id' => 5,
            'name' => 'carbooking::booking',
            'rights' => 7,
        ],
        [
            'profiles_id' => 5,
            'name' => 'carbooking::booking',
        ]
    );
    // Automatic: INSERT if not exists, else UPDATE
}
```

### Result in Database
```sql
-- Before
SELECT * FROM glpi_profilerights 
WHERE profiles_id=5 AND name='carbooking::booking';
-- Result: Empty (no row)

-- After updateOrInsert()
SELECT * FROM glpi_profilerights 
WHERE profiles_id=5 AND name='carbooking::booking';
-- Result:
-- | id | profiles_id | name                  | rights |
-- |----|-------------|----------------------|--------|
-- | 42 | 5           | carbooking::booking   | 7      |

-- Second save with different value
-- After updateOrInsert() with rights=5:
-- | 42 | 5           | carbooking::booking   | 5      |
-- (Same row updated, no duplicate)
```

---

## 7. Session Reload Detail

### GLPI 11 Session Structure
```php
$_SESSION['glpiactiveprofile'] = [
    'id' => 1,
    'name' => 'Super-Admin',
    'interface' => 'central',
    'rights' => [
        'all' => 1,
        'config' => 31,
        'carbooking::booking' => 7,      // ← Updated here
        'carbooking::car' => 1,          // ← Updated here
        ... // 200+ other rights
    ],
];
```

### Session Reload Process
```php
// BEFORE (old permissions)
$_SESSION['glpiactiveprofile']['rights'] = [
    'carbooking::booking' => 0,
    'carbooking::car' => 0,
    // ...
];

// GLPI 11 Core Function Call
$new_rights = ProfileRight::getProfileRights(1);
// Returns array from glpi_profilerights WHERE profiles_id=1

// AFTER (new permissions from DB)
$_SESSION['glpiactiveprofile']['rights'] = $new_rights;
// Now contains:
// 'carbooking::booking' => 7,
// 'carbooking::car' => 1,
```

### Session Usage in Pages
```php
// front/agenda.php
Session::checkRight('carbooking::booking', Booking::READ);
// Internally checks:
// if (($_SESSION['glpiactiveprofile']['rights']['carbooking::booking'] ?? 0) & Booking::READ) {
//    // Permission granted
// } else {
//    // Permission denied
// }
```

---

## 8. Logging & Debugging

### Log File Location
```
GLPI root/files/log/carbooking-*.log
```

### Log Entry Format
```
[2024-01-15 14:30:45] GLPI 11: Perfil 1 sincronizado com sucesso.
[2024-01-15 14:31:20] GLPI 11: Perfil 5 sincronizado com sucesso.
```

### Debug Session Tool
File: `front/debug_session.php`

Usage:
```
1. Access: http://glpi.local/plugins/carbooking/front/debug_session.php
2. If logged in: Shows all carbooking::* permissions in current session
3. Format:
   carbooking::booking = 7 (READ + UPDATE + CREATE)
   carbooking::car = 1 (READ)
```

### Debugging Hook Execution
Add to hook.php for debugging:
```php
// In plugin_carbooking_post_profile_update():
Toolbox::logInFile('carbooking', "DEBUG: POST['_rights'] = " . json_encode($_POST['_rights'] ?? []) . "\n");
Toolbox::logInFile('carbooking', "DEBUG: profiles_id = $profiles_id\n");
Toolbox::logInFile('carbooking', "DEBUG: Active profile id = " . ($_SESSION['glpiactiveprofile']['id'] ?? 'NONE') . "\n");
```

---

## 9. Error Scenarios & Recovery

### Scenario 1: updateOrInsert() Not Available (GLPI < 11)
```php
// Code handles fallback automatically:
if (method_exists($DB, 'updateOrInsert')) {
    // GLPI 11 path
    $DB->updateOrInsert(...);
} else {
    // GLPI 10 fallback
    if (countElementsInTable(...)) {
        $DB->update(...);
    } else {
        $DB->insert(...);
    }
}
```

### Scenario 2: POST['_rights'] Key Mismatch
```php
// If GLPI 11 sends 'rights' instead of '_rights':
if (!empty($_POST['_rights']) && is_array($_POST['_rights'])) {
    $post_rights = $_POST['_rights'];
} else {
    // FIX: Also check for 'rights' key
    if (!empty($_POST['rights']) && is_array($_POST['rights'])) {
        $post_rights = $_POST['rights'];
    }
}
// This would need to be tested with actual GLPI 11 instance
```

### Scenario 3: Session Not Reloading
```php
// Current code only syncs if active profile matches
if ($rights_updated && 
    isset($_SESSION['glpiactiveprofile']['id']) && 
    (int)$_SESSION['glpiactiveprofile']['id'] === $profiles_id) {
    // Sync happens
}

// For other users: May need to add to session at next request
// or use GLPI 11 broadcast mechanism (if available)
```

### Scenario 4: Profile::post_updateItem Hook Not Firing
**Symptoms:** Database updated but session not syncing
**Diagnosis:** 
1. Check setup.php registration:
   ```php
   $PLUGIN_HOOKS['item_update']['carbooking'] = ['Profile' => 'plugin_carbooking_post_profile_update'];
   ```
2. Verify hook function name is exact: `plugin_carbooking_post_profile_update`
3. Check GLPI error log: `files/log/glpi.log`

**Recovery:**
1. Manually reload user session or ask user to logout/login
2. Permissions take effect on next page load

---

## 10. Performance Considerations

### Database Query Count
Per profile save:
1. Read POST data: 0 queries
2. For each right (2 rights):
   - countElementsInTable() (fallback): 1 query
   - INSERT or UPDATE: 1 query
   - **Total fallback: 4 queries**
3. ProfileRight::getProfileRights(): 1-2 queries (if session sync enabled)
4. **Total: ~5-6 queries per save**

**GLPI 11 with updateOrInsert:**
1. For each right: 1 updateOrInsert() = 1-2 queries (atomic)
2. ProfileRight::getProfileRights(): 1-2 queries
3. **Total: ~4-6 queries per save** (similar)

### Session Reload Performance
- ProfileRight::getProfileRights() → Typically <100ms
- Session assignment → <1ms
- **No perceptible delay for user**

### Logging Performance
- Toolbox::logInFile() → File I/O, ~10-50ms
- Used only when session sync occurs (not every request)
- **Negligible impact**

---

## 11. GLPI 11 Compatibility Summary

| Feature | GLPI 10 | GLPI 11 | Plugin Support |
|---------|---------|---------|-----------------|
| Profile Hooks | YES | YES | ✓ |
| ProfileRight::getProfileRights() | YES | YES | ✓ |
| $DB->updateOrInsert() | NO | YES | ✓ (fallback) |
| $_POST['_rights'] format | YES | YES | ✓ |
| Session reload | YES | YES | ✓ |
| Helpdesk interface | YES | YES | ✓ |
| APPROVE bitmask | YES | YES | ✓ |
| Toolbox::logInFile() | YES | YES | ✓ |

---

## 12. Code Validation Checklist

- [ ] Hook registered in setup.php with correct class name
- [ ] hook.php function name matches PLUGIN_HOOKS entry
- [ ] POST extraction handles `$_POST['_rights']` (not `$_rights`)
- [ ] Bitmask parsing: (int) cast applied to values
- [ ] updateOrInsert() check uses method_exists()
- [ ] Fallback update/insert logic is correct
- [ ] Session sync checks all three conditions:
  - [ ] $rights_updated = true
  - [ ] $_SESSION['glpiactiveprofile']['id'] exists
  - [ ] profiles_id matches active profile ID
- [ ] ProfileRight::getProfileRights() called with correct profiles_id
- [ ] Session array assignment is $_SESSION['glpiactiveprofile']['rights'] = ...
- [ ] Logging uses Toolbox::logInFile() with correct file name
- [ ] No undefined variable warnings (all variables initialized)
- [ ] No type errors (integers for profiles_id, rights)

---

## 13. Testing Procedure

### Quick Validation (5 min)
1. Admin edits own profile, adds carbooking::booking READ (1)
2. Check log file for: "GLPI 11: Perfil [ID] sincronizado"
3. Check DB: `SELECT * FROM glpi_profilerights WHERE name='carbooking::booking'`
4. Access front/agenda.php → should load (permission granted)

### Full Validation (30 min)
Follow test cases in `GLPI11_COMPATIBILITY_TESTS.md`

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Compatibility:** GLPI 11.0+, GLPI 10 (fallback mode)
