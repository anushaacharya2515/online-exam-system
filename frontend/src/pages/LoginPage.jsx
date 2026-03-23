import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import loginIllustration from "../assets/login-illustration.jpg";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      if (mode === "register") {
        await api("/auth/register", { method: "POST", body: form });
        setMode("login");
      } else {
        const data = await api("/auth/login", { method: "POST", body: form });
        login(data);
        navigate(`/${data.user.role}`);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="center-wrap login-page">
      <div className="login-surface">
        <aside className="login-left">
          <img className="login-illustration" src={loginIllustration} alt="Online examination illustration" />
          <p className="eyebrow login-eyebrow">Secure Online Exams</p>
          <h1>Exam Master Hub</h1>
          <p>
            Unleash your academic success with a real-time online examination platform.
          </p>
          <div className="login-features">
            <span>Live timer</span>
            <span>Auto submit</span>
            <span>AI retake questions</span>
          </div>
          <div className="slide-dots">
            <span className="active" />
            <span />
            <span />
          </div>
        </aside>

        <form className="login-right" onSubmit={handleSubmit}>
          <h2 className="login-brand">ExamPortal</h2>
          <p className="login-sub">{mode === "login" ? "Sign in to continue" : "Create your student account"}</p>

          {mode === "register" && (
            <>
              <input
                required
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </>
          )}

          <label>Email</label>
          <input
            required
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label>Password</label>
          <div className="password-wrap">
            <input
              required
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="button" className="toggle-pass" onClick={() => setShowPassword((s) => !s)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="login-meta-row">
            <small>Live: {now.toLocaleTimeString()}</small>
            <a href="#!" onClick={(e) => e.preventDefault()}>Forgot password?</a>
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="login-submit">{mode === "login" ? "Sign in" : "Create account"}</button>
          <div className="login-divider"><span>or</span></div>
          <button type="button" className="google-btn">Sign in with Google</button>

          <small className="admin-hint">Admin demo: admin@exam.com / admin123</small>
          <button
            type="button"
            className="ghost"
            onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
          >
            {mode === "login" ? "New user? Create account" : "Already have account? Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
