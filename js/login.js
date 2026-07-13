/**
 * login.js — controller for index.html
 * ---------------------------------------------------------------------------
 */
import { signUp, logIn, redirectIfAuthed, friendlyAuthError } from "./auth.js";
import { showToast } from "./toast.js";

// If already signed in, skip straight to the library.
redirectIfAuthed();

const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

function setTab(which) {
  const isLogin = which === "login";
  tabLogin.classList.toggle("is-active", isLogin);
  tabSignup.classList.toggle("is-active", !isLogin);
  tabLogin.setAttribute("aria-selected", String(isLogin));
  tabSignup.setAttribute("aria-selected", String(!isLogin));
  loginForm.style.display = isLogin ? "block" : "none";
  signupForm.style.display = isLogin ? "none" : "block";
}

tabLogin.addEventListener("click", () => setTab("login"));
tabSignup.addEventListener("click", () => setTab("signup"));

function setSubmitting(button, isSubmitting, labelWhileLoading) {
  button.disabled = isSubmitting;
  const label = button.querySelector(".btn-label");
  if (isSubmitting) {
    button.dataset.originalLabel = label.textContent;
    label.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>`;
  } else {
    label.textContent = button.dataset.originalLabel || labelWhileLoading;
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");
  errorEl.textContent = "";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  setSubmitting(submitBtn, true);
  try {
    await logIn(email, password);
    window.location.href = "library.html";
  } catch (err) {
    errorEl.textContent = friendlyAuthError(err);
    setSubmitting(submitBtn, false, "Log In");
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("signup-error");
  const submitBtn = document.getElementById("signup-submit");
  errorEl.textContent = "";

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  setSubmitting(submitBtn, true);
  try {
    await signUp(email, password, name);
    showToast("Account created — welcome!", "success");
    window.location.href = "library.html";
  } catch (err) {
    errorEl.textContent = friendlyAuthError(err);
    setSubmitting(submitBtn, false, "Create Account");
  }
});
