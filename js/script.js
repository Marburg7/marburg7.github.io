/**
 * Syed Shahabuddin Portfolio — Interactions, Scroll Reveals & Contact Form
 */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------------
     1. Scroll-triggered reveal animations (IntersectionObserver)
     ------------------------------------------------------------------------ */
  function initScrollReveals() {
    const targets = document.querySelectorAll(".reveal-on-scroll");
    if (!targets.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    targets.forEach((el) => observer.observe(el));
  }

  /* ------------------------------------------------------------------------
     2. Select placeholder styling sync
     ------------------------------------------------------------------------ */
  function initSelectPlaceholders() {
    const selects = document.querySelectorAll("select.form-control");
    selects.forEach((sel) => {
      const update = () => {
        sel.classList.toggle("is-placeholder", !sel.value);
      };
      update();
      sel.addEventListener("change", update);
    });
  }

  /* ------------------------------------------------------------------------
     3. Contact Form Validation & Submission (Works cleanly on GitHub Pages)
     ------------------------------------------------------------------------ */
  function initContactForms() {
    const forms = document.querySelectorAll(".contact-form");
    forms.forEach((form) => {
      const statusEl = form.querySelector(".form-status");
      const submitBtn = form.querySelector(".form-submit");

      form.addEventListener("submit", (event) => {
        event.preventDefault();

        const nameInput = form.querySelector('input[name="Name"]');
        const emailInput = form.querySelector('input[name="Email"]');
        const serviceInput = form.querySelector('select[name="Service"]');
        const messageInput = form.querySelector('textarea[name="Message"]');

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const service = serviceInput ? serviceInput.value.trim() : "";
        const message = messageInput ? messageInput.value.trim() : "";

        if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showStatus(
            statusEl,
            "Please enter your name and a valid email address.",
            "error"
          );
          if (!name && nameInput) nameInput.focus();
          else if (emailInput) emailInput.focus();
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Sending...";
        }

        const subject = encodeURIComponent(
          `Portfolio Inquiry${service ? ` — ${service}` : ""} from ${name}`
        );
        const bodyLines = [
          `Name: ${name}`,
          `Email: ${email}`,
          service ? `Service Looking For: ${service}` : null,
          "",
          "Message:",
          message || "(No message provided)",
        ].filter((line) => line !== null);

        const mailtoHref = `mailto:syedshafaiz76@gmail.com?subject=${subject}&body=${encodeURIComponent(
          bodyLines.join("\n")
        )}`;

        window.setTimeout(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit";
          }

          showStatus(
            statusEl,
            `Thanks, ${name}! Your message is ready — opening your email client to send to syedshafaiz76@gmail.com.`,
            "success"
          );

          // Open default mail client with pre-filled details
          const tempLink = document.createElement("a");
          tempLink.href = mailtoHref;
          tempLink.style.display = "none";
          document.body.appendChild(tempLink);
          tempLink.click();
          document.body.removeChild(tempLink);

          form.reset();
          initSelectPlaceholders();
        }, 350);
      });
    });
  }

  function showStatus(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `form-status is-visible form-status--${type}`;
  }

  /* ------------------------------------------------------------------------
     4. Initialize on DOM ready
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initScrollReveals();
    initSelectPlaceholders();
    initContactForms();
  });
})();
