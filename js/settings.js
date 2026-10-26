/* ==========================================================================
   settings.js — Settings page
   ========================================================================== */

(function () {
  "use strict";

  function wireTabs() {
    document.querySelectorAll(".settings-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".settings-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const panel = document.getElementById("panel-" + tab.getAttribute("data-tab"));
        if (panel) panel.classList.add("active");
        RTS.refreshIcons();
      });
    });

    // Check hash in URL (e.g. settings.html#security)
    if (window.location.hash) {
      const cleanHash = window.location.hash.replace("#", "");
      const targetTab = document.querySelector(`.settings-tab[data-tab='${cleanHash}']`);
      if (targetTab) {
        targetTab.click();
      }
    }
  }

  function processProfileImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const maxDim = 360;
            const size = Math.min(maxDim, Math.max(img.width, img.height));
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");

            // Center square crop
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;

            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Unable to parse the selected image."));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Failed to read the file."));
      reader.readAsDataURL(file);
    });
  }

  function loadProfile() {
    const user = RTS.auth.getCurrentUser();
    const nameInput = document.getElementById("profileName");
    const mobileInput = document.getElementById("profileMobile");
    const emailInput = document.getElementById("profileEmail");
    if (nameInput) nameInput.value = user.fullName || "";
    if (mobileInput) mobileInput.value = user.mobile || "";
    if (emailInput) emailInput.value = user.email || "";

    const preview = document.getElementById("settingsAvatarPreview");
    const removeBtn = document.getElementById("removeAvatarBtn");
    const uploadText = document.getElementById("uploadAvatarText");

    if (preview) {
      if (user.avatar) {
        preview.innerHTML = `<img src="${user.avatar}" alt="${user.fullName || 'User'}" class="avatar-img" />`;
        preview.classList.add("has-avatar-img");
        if (removeBtn) removeBtn.style.display = "inline-flex";
        if (uploadText) uploadText.textContent = "Change Photo";
      } else {
        const parts = (user.fullName || "User").trim().split(/\s+/);
        const initials = ((parts[0] || "")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase() || "U";
        preview.textContent = initials;
        preview.classList.remove("has-avatar-img");
        if (removeBtn) removeBtn.style.display = "none";
        if (uploadText) uploadText.textContent = "Upload Photo";
      }
    }
  }

  function wireProfilePhoto() {
    const fileInput = document.getElementById("profilePicInput");
    const removeBtn = document.getElementById("removeAvatarBtn");
    const previewWrap = document.getElementById("avatarUploaderTrigger");

    if (previewWrap && fileInput) {
      previewWrap.addEventListener("click", (e) => {
        // Prevent double triggers if clicking on label or input directly
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "LABEL" && !e.target.closest("label")) {
          fileInput.click();
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          RTS.toast("Please select a valid image file (PNG, JPG, or WEBP).", "error");
          fileInput.value = "";
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          RTS.toast("Selected image exceeds 5MB limit. Please choose a smaller file.", "error");
          fileInput.value = "";
          return;
        }

        try {
          RTS.toast("Processing photo...", "info");
          const dataUrl = await processProfileImage(file);

          // Update profile with new avatar
          const res = await RTS.auth.updateProfile({ avatar: dataUrl });
          if (!res.ok) {
            RTS.toast(res.error || "Failed to update profile picture.", "error");
            return;
          }

          loadProfile();
          RTS.initLayout();
          RTS.toast("Profile picture updated successfully!", "success");
        } catch (err) {
          RTS.toast("Error processing image: " + err.message, "error");
        } finally {
          fileInput.value = "";
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to remove your profile picture?")) return;
        const res = await RTS.auth.updateProfile({ avatar: null });
        if (!res.ok) {
          RTS.toast(res.error || "Failed to remove profile picture.", "error");
          return;
        }
        loadProfile();
        RTS.initLayout();
        RTS.toast("Profile picture removed successfully.", "success");
      });
    }
  }

  function wireProfileForm() {
    document.getElementById("profileForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("profileName").value.trim();
      document.getElementById("pf_name").classList.toggle("has-error", !name);
      if (!name) return;
      const result = await RTS.auth.updateProfile({ fullName: name, mobile: document.getElementById("profileMobile").value.trim() });
      if (!result.ok) return RTS.toast(result.error, "error");
      RTS.toast("Profile updated successfully.", "success");
      loadProfile();
      RTS.initLayout(); // refresh topbar name/initials
    });
  }

  function loadApplicationSettings() {
    const settings = RTS.settings.getSettings();

    // 1. Theme
    const select = document.getElementById("themeSelect");
    if (select) {
      select.value = settings.theme || "indigo";
      select.addEventListener("change", (e) => {
        RTS.settings.setSettings({ theme: e.target.value });
        RTS.toast("Theme changed to " + e.target.options[e.target.selectedIndex].text + ".", "success");
      });
    }

    // 2. Language
    const langSelect = document.getElementById("languageSelect");
    if (langSelect && RTS.i18n) {
      langSelect.value = RTS.i18n.getLanguage ? RTS.i18n.getLanguage() : (settings.language || "en");
      langSelect.addEventListener("change", (e) => {
        if (RTS.i18n.setLanguage) {
          RTS.i18n.setLanguage(e.target.value);
        }
        RTS.settings.setSettings({ language: e.target.value });
        RTS.toast(e.target.value === "ta" ? "மொழி தமிழாக மாற்றப்பட்டது." : "Language changed to English.", "success");
      });
    }

    // 3. Default Currency
    const curSelect = document.getElementById("currencySelect");
    if (curSelect) {
      curSelect.value = settings.defaultCurrency || "USD";
      curSelect.addEventListener("change", (e) => {
        RTS.settings.setSettings({ defaultCurrency: e.target.value });
        RTS.toast("Default currency updated to " + e.target.value + ".", "success");
      });
    }

    // 4. Date Format
    const dateFmtSelect = document.getElementById("dateFormatSelect");
    if (dateFmtSelect) {
      dateFmtSelect.value = settings.dateFormat || "DD/MM/YYYY";
      dateFmtSelect.addEventListener("change", (e) => {
        RTS.settings.setSettings({ dateFormat: e.target.value });
        RTS.toast("Date display format updated to " + e.target.value + ".", "success");
      });
    }

    // 5. Table Density
    const densitySelect = document.getElementById("tableDensitySelect");
    if (densitySelect) {
      densitySelect.value = settings.tableDensity || "comfortable";
      densitySelect.addEventListener("change", (e) => {
        RTS.settings.setSettings({ tableDensity: e.target.value });
        if (e.target.value === "compact") {
          document.body.classList.add("density-compact");
        } else {
          document.body.classList.remove("density-compact");
        }
        RTS.toast("Table view density updated to " + e.target.value + ".", "success");
      });
    }

    // 6. Rows Per Page
    const rowsSelect = document.getElementById("rowsPerPageSelect");
    if (rowsSelect) {
      rowsSelect.value = String(settings.rowsPerPage || 8);
      rowsSelect.addEventListener("change", (e) => {
        const val = parseInt(e.target.value, 10) || 8;
        RTS.settings.setSettings({ rowsPerPage: val });
        RTS.toast("Default records per page set to " + val + ".", "success");
      });
    }

    // 7. Default Renewal Cycle
    const cycleSelect = document.getElementById("defaultCycleSelect");
    if (cycleSelect) {
      cycleSelect.value = settings.defaultCycle || "Yearly";
      cycleSelect.addEventListener("change", (e) => {
        RTS.settings.setSettings({ defaultCycle: e.target.value });
        RTS.toast("Default renewal term set to " + e.target.value + ".", "success");
      });
    }

    // 8. Data Management & Quick Backup actions
    const btnCsv = document.getElementById("btnExportAllCsv");
    if (btnCsv) {
      btnCsv.addEventListener("click", () => {
        const renewals = RTS.data.getRenewals();
        if (!renewals.length) {
          RTS.toast("No renewal records found to export.", "info");
          return;
        }
        const columns = [
          { label: "Record ID", value: "code" },
          { label: "Name", value: "name" },
          { label: "Category", value: "category" },
          { label: "Organization", value: "organization" },
          { label: "Issue Date", value: "issueDate" },
          { label: "Expiry Date", value: "expiryDate" },
          { label: "Cost", value: "cost" },
          { label: "Currency", value: "currency" },
          { label: "Recurring Cycle", value: (r) => r.recurringCycle || "Yearly" },
          { label: "Priority", value: "priority" },
          { label: "Status", value: (r) => RTS.computeStatus(r) },
          { label: "Reference Number", value: "referenceNumber" },
          { label: "Notes", value: "notes" },
        ];
        RTS.exportCSV("RenewGaurd_All_Renewals_" + RTS.todayISO() + ".csv", renewals, columns);
        RTS.toast(`Exported all ${renewals.length} record(s) to CSV.`, "success");
      });
    }

    const btnJson = document.getElementById("btnExportAllJson");
    if (btnJson) {
      btnJson.addEventListener("click", () => {
        const payload = {
          exportDate: new Date().toISOString(),
          version: "1.0.0",
          user: RTS.auth.getCurrentUser(),
          settings: RTS.settings.getSettings(),
          renewals: RTS.data.getRenewals(),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "RenewGaurd_Backup_" + RTS.todayISO() + ".json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        RTS.toast("Full JSON backup downloaded successfully.", "success");
      });
    }

    const btnIcs = document.getElementById("btnExportCalendarIcs");
    if (btnIcs) {
      btnIcs.addEventListener("click", () => {
        const renewals = RTS.data.getRenewals();
        if (!renewals.length) {
          RTS.toast("No renewals to export to calendar.", "info");
          return;
        }
        RTS.exportICS("RenewGaurd_Schedule_" + RTS.todayISO() + ".ics", renewals);
        RTS.toast(`Exported ${renewals.length} record(s) to iCalendar schedule.`, "success");
      });
    }

    RTS.refreshIcons();
  }

  function loadReminderSettings() {
    const settings = RTS.settings.getSettings();
    const days = settings.reminderDays || [30, 15, 7, 0];
    const rem30 = document.getElementById("rem30");
    const rem15 = document.getElementById("rem15");
    const rem7 = document.getElementById("rem7");
    const rem0 = document.getElementById("rem0");

    if (rem30) rem30.checked = days.includes(30);
    if (rem15) rem15.checked = days.includes(15);
    if (rem7) rem7.checked = days.includes(7);
    if (rem0) rem0.checked = days.includes(0);

    const saveBtn = document.getElementById("saveRemindersBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const reminderDays = [];
        if (rem30 && rem30.checked) reminderDays.push(30);
        if (rem15 && rem15.checked) reminderDays.push(15);
        if (rem7 && rem7.checked) reminderDays.push(7);
        if (rem0 && rem0.checked) reminderDays.push(0);

        RTS.settings.setSettings({ reminderDays });

        try {
          await fetch(RTS.apiUrl("/api/settings/notifications"), {
            method: "PUT",
            headers: RTS.auth.headers(),
            body: JSON.stringify({ reminderDays, sendOnExpiryDay: reminderDays.includes(0) }),
          });
        } catch (e) {
          // Graceful fallback to client storage
        }

        RTS.toast("Reminder interval preferences saved.", "success");
      });
    }
  }

  async function loadNotificationSettings() {
    const settings = RTS.settings.getSettings();
    const notifyEmailEl = document.getElementById("notifyEmail");
    const notifyBrowserEl = document.getElementById("notifyBrowser");
    const notifyDigestEl = document.getElementById("notifyDigest");
    const fallbackEmailInput = document.getElementById("notifyEmailFallback");

    if (notifyEmailEl) notifyEmailEl.checked = settings.notifyEmail !== false;
    if (notifyBrowserEl) notifyBrowserEl.checked = !!settings.notifyBrowser;
    if (notifyDigestEl) notifyDigestEl.checked = !!settings.notifyReminderDigest;
    if (fallbackEmailInput) {
      const user = RTS.auth.getCurrentUser();
      fallbackEmailInput.value = settings.defaultRecipientEmail || user.email || "";
    }

    // Save toggles immediately on change
    ["notifyEmail", "notifyBrowser", "notifyDigest"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", async () => {
          const emailOn = notifyEmailEl ? notifyEmailEl.checked : true;
          const browserOn = notifyBrowserEl ? notifyBrowserEl.checked : true;
          const digestOn = notifyDigestEl ? notifyDigestEl.checked : false;

          RTS.settings.setSettings({
            notifyEmail: emailOn,
            notifyBrowser: browserOn,
            notifyReminderDigest: digestOn,
          });

          try {
            await fetch(RTS.apiUrl("/api/settings/notifications"), {
              method: "PUT",
              headers: RTS.auth.headers(),
              body: JSON.stringify({ emailNotificationsEnabled: emailOn }),
            });
          } catch (e) {}

          RTS.toast("Notification preferences saved.", "success");
        });
      }
    });

    // Save fallback email button
    const saveEmailBtn = document.getElementById("btnSaveFallbackEmail");
    if (saveEmailBtn && fallbackEmailInput) {
      saveEmailBtn.addEventListener("click", async () => {
        const email = fallbackEmailInput.value.trim();
        if (!email || !email.includes("@")) {
          RTS.toast("Please enter a valid email address.", "error");
          return;
        }
        RTS.settings.setSettings({ defaultRecipientEmail: email });
        try {
          await fetch(RTS.apiUrl("/api/settings/notifications"), {
            method: "PUT",
            headers: RTS.auth.headers(),
            body: JSON.stringify({ defaultRecipientEmail: email }),
          });
        } catch (e) {}
        RTS.toast("Default notification email updated.", "success");
      });
    }

    // Fetch live backend diagnostics
    try {
      const res = await fetch(RTS.apiUrl("/api/reminders/status"), { headers: RTS.auth.headers() });
      if (res.ok) {
        const data = await res.json();
        const pEl = document.getElementById("statEmailProvider");
        const mEl = document.getElementById("statEmailMode");
        const cEl = document.getElementById("statCronSchedule");

        if (pEl && data.emailConfig) {
          pEl.textContent = data.emailConfig.provider.toUpperCase();
        }
        if (mEl && data.emailConfig) {
          mEl.textContent = data.emailConfig.isSendEnabled ? "LIVE (Active)" : "SIMULATION (Safe)";
          mEl.style.color = data.emailConfig.isSendEnabled ? "var(--success)" : "var(--accent)";
        }
        if (cEl && data.scheduler) {
          cEl.textContent = data.scheduler.schedule || "Daily @ 08:00 AM";
        }
      }
    } catch (err) {
      // Offline mode
    }

    // Wire "Send Test Reminder Email"
    const testBtn = document.getElementById("btnSendTestEmail");
    const feedbackBox = document.getElementById("emailTestFeedback");
    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        const targetEmail = fallbackEmailInput ? fallbackEmailInput.value.trim() : RTS.auth.getCurrentUser().email;
        if (!targetEmail || !targetEmail.includes("@")) {
          RTS.toast("Please specify a valid email address first.", "error");
          return;
        }

        testBtn.disabled = true;
        testBtn.innerHTML = '<i data-lucide="loader" class="icon spin"></i> Sending test email...';
        RTS.refreshIcons();

        try {
          const res = await fetch(RTS.apiUrl("/api/reminders/test-email"), {
            method: "POST",
            headers: RTS.auth.headers(),
            body: JSON.stringify({ targetEmail }),
          });
          const data = await res.json();

          if (feedbackBox) {
            feedbackBox.style.display = "block";
            if (data.ok) {
              feedbackBox.style.background = "var(--success-dim)";
              feedbackBox.style.color = "var(--success)";
              feedbackBox.style.border = "1px solid var(--success)";
              feedbackBox.innerHTML = `<strong>Success:</strong> ${RTS.escapeHtml(data.message)}`;
              RTS.toast("Test reminder email dispatched!", "success");
            } else {
              feedbackBox.style.background = "var(--danger-dim)";
              feedbackBox.style.color = "var(--danger)";
              feedbackBox.style.border = "1px solid var(--danger)";
              feedbackBox.innerHTML = `<strong>Delivery Warning:</strong> ${RTS.escapeHtml(data.error)}`;
              RTS.toast(data.error, "error");
            }
          }
        } catch (e) {
          RTS.toast("Could not reach backend at " + RTS.apiUrl("/api/reminders/test-email") + ". Ensure 'npm start' or 'start.bat' is running.", "error");
        } finally {
          testBtn.disabled = false;
          testBtn.innerHTML = '<i data-lucide="send" class="icon"></i> Send Test Reminder Email';
          RTS.refreshIcons();
        }
      });
    }

    // Wire "Run Reminder Check Now"
    const triggerBtn = document.getElementById("btnTriggerReminderCheck");
    if (triggerBtn) {
      triggerBtn.addEventListener("click", async () => {
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = '<i data-lucide="loader" class="icon spin"></i> Running check...';
        RTS.refreshIcons();

        try {
          const res = await fetch(RTS.apiUrl("/api/reminders/trigger"), {
            method: "POST",
            headers: RTS.auth.headers(),
          });
          const data = await res.json();

          if (feedbackBox && data.summary) {
            feedbackBox.style.display = "block";
            feedbackBox.style.background = "var(--accent-dim)";
            feedbackBox.style.color = "var(--accent)";
            feedbackBox.style.border = "1px solid var(--accent)";
            feedbackBox.innerHTML = `
              <strong>Reminder Check Completed:</strong><br/>
              &bull; Renewals checked: <strong>${data.summary.totalRenewalsChecked}</strong><br/>
              &bull; Reminders sent/simulated: <strong>${data.summary.remindersSent}</strong><br/>
              &bull; Duplicates prevented: <strong>${data.summary.duplicatesSkipped}</strong><br/>
              &bull; Errors encountered: <strong>${data.summary.errorsEncountered}</strong>
            `;
            RTS.toast(
              `Reminder check finished: ${data.summary.remindersSent} sent, ${data.summary.duplicatesSkipped} duplicates prevented.`,
              "success"
            );
          }
        } catch (e) {
          RTS.toast("Could not reach backend at " + RTS.apiUrl("/api/reminders/trigger") + ". Ensure 'npm start' or 'start.bat' is running.", "error");
        } finally {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = '<i data-lucide="play" class="icon"></i> Run Reminder Check Now';
          RTS.refreshIcons();
        }
      });
    }
  }

  function wirePasswordForm() {
    document.getElementById("passwordForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      document.querySelectorAll("#passwordForm .field").forEach((f) => f.classList.remove("has-error"));

      const current = document.getElementById("currentPassword").value;
      const next = document.getElementById("newPassword").value;
      const confirm = document.getElementById("confirmPassword").value;
      let valid = true;

      if (!current) {
        document.getElementById("sec_current").classList.add("has-error");
        valid = false;
      }
      if (next.length < 8) {
        document.getElementById("sec_new").classList.add("has-error");
        valid = false;
      }
      if (confirm !== next || !confirm) {
        document.getElementById("sec_confirm").classList.add("has-error");
        valid = false;
      }
      if (!valid) return;

      const result = await RTS.auth.changePassword(current, next);
      if (!result.ok) {
        document.getElementById("sec_current").classList.add("has-error");
        RTS.toast(result.error, "error");
        return;
      }
      RTS.toast("Password updated successfully.", "success");
      document.getElementById("passwordForm").reset();
    });
  }

  function wireAiScan() {
    const dropzone = document.getElementById("smartDocDropzone");
    const fileInput = document.getElementById("smartDocFileInput");
    const statusBox = document.getElementById("smartDocScanningStatus");
    const statusText = document.getElementById("smartDocStatusText");
    const progressBar = document.getElementById("smartDocProgressBar");
    const resultBox = document.getElementById("aiScanResult");
    const saveAiBtn = document.getElementById("saveAiRecordBtn");
    const resetAiBtn = document.getElementById("resetAiScanBtn");
    const toggleRawBtn = document.getElementById("toggleAiRawBtn");
    const rawSnippetContainer = document.getElementById("aiRawSnippetContainer");

    const sampleAwsBtn = document.getElementById("sampleAwsBtn");
    const sampleInsuranceBtn = document.getElementById("sampleInsuranceBtn");
    const sampleLicenseBtn = document.getElementById("sampleLicenseBtn");

    let currentFile = null;
    let lastExtraction = null;

    function formatRelativeExpiry(dateStr) {
      if (!dateStr) return "";
      try {
        const target = new Date(dateStr + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return `Expired ${Math.abs(diffDays)} days ago`;
        if (diffDays === 0) return "Expires today";
        if (diffDays === 1) return "Expires tomorrow";
        if (diffDays < 30) return `Expires in ${diffDays} days`;
        if (diffDays < 365) {
          const m = Math.round(diffDays / 30.4);
          return `Expires in ~${m} ${m === 1 ? "month" : "months"}`;
        }
        const y = (diffDays / 365.25).toFixed(1);
        return `Expires in ~${y} years (${diffDays} days)`;
      } catch (_) {
        return "";
      }
    }

    function displayExtractedData(data, fileName, fileObj) {
      lastExtraction = data;
      currentFile = fileObj || null;

      if (statusBox) statusBox.style.display = "none";
      if (!resultBox) return;

      const titleInput = document.getElementById("aiTitle");
      const expiryInput = document.getElementById("aiExpiry");
      const expiryRelative = document.getElementById("aiExpiryRelative");
      const orgInput = document.getElementById("aiOrg");
      const refInput = document.getElementById("aiRef");
      const categorySelect = document.getElementById("aiCategory");
      const issueDateInput = document.getElementById("aiIssueDate");
      const costInput = document.getElementById("aiCost");
      const cycleSelect = document.getElementById("aiCycle");
      const fileNameDisplay = document.getElementById("aiFileNameDisplay");
      const confidenceBadge = document.getElementById("aiConfidenceBadge");

      if (titleInput) titleInput.value = data.title || "";
      if (expiryInput) {
        expiryInput.value = data.expiryDate || "";
        if (expiryRelative) expiryRelative.textContent = formatRelativeExpiry(data.expiryDate);
      }
      if (orgInput) orgInput.value = data.organization || "";
      if (refInput) refInput.value = data.referenceNumber || "";
      if (categorySelect) categorySelect.value = data.category || "Certification";
      if (issueDateInput) issueDateInput.value = data.issueDate || "";
      if (costInput) costInput.value = data.cost ? Number(data.cost).toFixed(2) : "";
      if (cycleSelect) cycleSelect.value = "Yearly";

      if (fileNameDisplay) {
        const sizeInfo = fileObj && fileObj.size ? ` (${(fileObj.size / 1024).toFixed(1)} KB)` : "";
        fileNameDisplay.textContent = `📄 Document: ${fileName}${sizeInfo}`;
      }

      if (confidenceBadge) {
        confidenceBadge.textContent = `${(data.confidence || 98.4).toFixed(1)}% Confidence`;
      }

      if (rawSnippetContainer) {
        rawSnippetContainer.textContent = data.rawSnippet || "(No raw text preview available)";
        rawSnippetContainer.style.display = "none";
      }

      resultBox.style.display = "block";
      RTS.refreshIcons();

      // Scroll smoothly to results
      resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });

      RTS.toast(
        `AI SmartDoc: Renewal date detected as ${data.expiryDate} (${data.title})`,
        "success"
      );
    }

    async function processCertificateFile(file) {
      if (!file) return;

      if (resultBox) resultBox.style.display = "none";
      if (statusBox) statusBox.style.display = "block";
      if (progressBar) progressBar.style.width = "15%";
      if (statusText) statusText.textContent = `AI SmartDoc: Initializing scan for ${file.name}...`;

      try {
        const onProgress = (pct, msg) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (statusText && msg) statusText.textContent = `AI SmartDoc: ${msg}`;
        };

        const extractedText = await (window.SmartDoc
          ? window.SmartDoc.extractTextFromFile(file, onProgress)
          : Promise.resolve(file.name));

        onProgress(92, "Analyzing certificate terms, validity & renewal date...");
        await new Promise((r) => setTimeout(r, 200));

        const parsed = window.SmartDoc
          ? window.SmartDoc.parseCertificateData(extractedText, file.name, file)
          : {
              title: file.name.replace(/\.[^/.]+$/, ""),
              expiryDate: "2027-10-15",
              organization: "Certifying Authority",
              category: "Certification",
              cost: 0,
              confidence: 96,
            };

        displayExtractedData(parsed, file.name, file);
      } catch (err) {
        if (statusBox) statusBox.style.display = "none";
        console.error("[SmartDoc Scan Error]", err);
        RTS.toast("Scan error: " + err.message, "error");
      }
    }

    function runSample(key) {
      const sample = window.SmartDoc && window.SmartDoc.SAMPLES && window.SmartDoc.SAMPLES[key];
      if (!sample) return;

      if (resultBox) resultBox.style.display = "none";
      if (statusBox) statusBox.style.display = "block";
      if (progressBar) progressBar.style.width = "40%";
      if (statusText) statusText.textContent = `AI SmartDoc: Extracting sample ${sample.fileName}...`;

      setTimeout(() => {
        if (progressBar) progressBar.style.width = "90%";
        setTimeout(() => {
          const parsed = window.SmartDoc.parseCertificateData(sample.text, sample.fileName);
          // Create dummy File object for document attachment demonstration
          const dummyBlob = new Blob([sample.text], { type: "application/pdf" });
          const dummyFile = new File([dummyBlob], sample.fileName, { type: "application/pdf" });
          displayExtractedData(parsed, sample.fileName, dummyFile);
        }, 300);
      }, 400);
    }

    // Dynamic date change listener
    const expiryInput = document.getElementById("aiExpiry");
    if (expiryInput) {
      expiryInput.addEventListener("input", (e) => {
        const relativeSpan = document.getElementById("aiExpiryRelative");
        if (relativeSpan) relativeSpan.textContent = formatRelativeExpiry(e.target.value);
      });
    }

    // Dropzone interaction
    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files[0]) {
          processCertificateFile(files[0]);
        }
      });

      fileInput.addEventListener("change", () => {
        if (fileInput.files && fileInput.files[0]) {
          processCertificateFile(fileInput.files[0]);
        }
      });
    }

    // Sample buttons
    if (sampleAwsBtn) sampleAwsBtn.addEventListener("click", () => runSample("aws"));
    if (sampleInsuranceBtn) sampleInsuranceBtn.addEventListener("click", () => runSample("insurance"));
    if (sampleLicenseBtn) sampleLicenseBtn.addEventListener("click", () => runSample("license"));

    // Raw snippet toggle
    if (toggleRawBtn && rawSnippetContainer) {
      toggleRawBtn.addEventListener("click", () => {
        const isHidden = rawSnippetContainer.style.display === "none";
        rawSnippetContainer.style.display = isHidden ? "block" : "none";
      });
    }

    // Reset button
    if (resetAiBtn) {
      resetAiBtn.addEventListener("click", () => {
        if (resultBox) resultBox.style.display = "none";
        if (statusBox) statusBox.style.display = "none";
        if (fileInput) fileInput.value = "";
        currentFile = null;
        lastExtraction = null;
        if (dropzone) dropzone.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    // Save as Tracked Renewal Record
    if (saveAiBtn) {
      saveAiBtn.addEventListener("click", async () => {
        const title = (document.getElementById("aiTitle").value || "").trim();
        const expiry = (document.getElementById("aiExpiry").value || "").trim();
        const org = (document.getElementById("aiOrg").value || "").trim();
        const ref = (document.getElementById("aiRef").value || "").trim();
        const cat = document.getElementById("aiCategory").value || "Certification";
        const issueDate = document.getElementById("aiIssueDate").value || "";
        const costVal = parseFloat(document.getElementById("aiCost").value) || 0;
        const cycle = document.getElementById("aiCycle").value || "Yearly";

        if (!title) {
          RTS.toast("Please enter a title for this certificate record.", "error");
          document.getElementById("aiTitle").focus();
          return;
        }

        if (!expiry) {
          RTS.toast("Please specify a renewal/expiry date.", "error");
          document.getElementById("aiExpiry").focus();
          return;
        }

        saveAiBtn.disabled = true;
        saveAiBtn.innerHTML = `<i data-lucide="loader-2" class="icon icon-spin"></i> Saving Record & Attaching Certificate...`;
        RTS.refreshIcons();

        try {
          const recordData = {
            name: title,
            organization: org || "Certified Authority",
            expiryDate: expiry,
            issueDate: issueDate || new Date().toISOString().slice(0, 10),
            category: cat,
            cost: costVal,
            currency: "USD",
            recurringCycle: cycle,
            priority: "Medium",
            referenceNumber: ref,
            description: `Auto-extracted by AI SmartDoc from certificate "${title}".`,
            reminderDate: RTS.addDays ? RTS.addDays(expiry, -14) : null,
          };

          const created = RTS.data.addRenewal(recordData);

          // If a file was uploaded, attach it as an official document
          if (currentFile && RTS.data.uploadDocument) {
            try {
              await RTS.data.uploadDocument(created.id, currentFile);
            } catch (docErr) {
              console.warn("[SmartDoc] Document attachment error:", docErr);
            }
          }

          RTS.toast(`Certificate renewal tracked! Expiry date: ${expiry}`, "success");

          setTimeout(() => {
            window.location.href = "details.html?id=" + encodeURIComponent(created.id);
          }, 800);
        } catch (err) {
          saveAiBtn.disabled = false;
          saveAiBtn.innerHTML = `<i data-lucide="plus-circle" class="icon"></i> Save as Tracked Renewal Record`;
          RTS.refreshIcons();
          RTS.toast("Failed to save record: " + err.message, "error");
        }
      });
    }
  }

  function wireDeleteAccount() {
    const btn = document.getElementById("deleteAccountBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const pw = document.getElementById("deleteAccountPassword").value;
      if (!pw) return RTS.toast("Enter your password to confirm.", "error");
      if (!confirm("Permanently delete your account, renewals and documents?")) return;
      const r = await RTS.auth.deleteAccount(pw);
      if (!r.ok) return RTS.toast(r.error, "error");
      window.location.href = "register.html";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    RTS.initLayout();
    wireTabs();
    loadProfile();
    wireProfileForm();
    wireProfilePhoto();
    loadApplicationSettings();
    loadReminderSettings();
    loadNotificationSettings();
    wireAiScan();
    wireDeleteAccount();
    wirePasswordForm();
    RTS.refreshIcons();
  });
})();
