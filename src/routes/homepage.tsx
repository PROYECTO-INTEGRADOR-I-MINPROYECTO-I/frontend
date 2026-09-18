import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div>
      <h1>Home Page</h1>
      <Link to="/login">Go to Login</Link>
    </div>
  );
}