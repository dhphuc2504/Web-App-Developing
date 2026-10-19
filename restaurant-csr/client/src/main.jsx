import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AppProvider, useApp } from "./components/AppContext.jsx";
import { Home, Directory, Menu, DishDetail } from "./pages/Public.jsx";
import {
  Guard,
  Login,
  Kitchen,
  CatalogEditor,
  Pantry,
  Categories,
  Office,
  Chefs,
} from "./pages/Staff.jsx";
import { StockForm, Journal, Ledger, Recipe } from "./pages/Inventory.jsx";
import { ErrorNotice } from "./components/common.jsx";
import { sessionApi } from "./api/resources.js";
import { useMutation } from "./hooks/useResource.js";
import "./styles.css";
function Shell() {
  const { user, setUser } = useApp(),
    location = useLocation(),
    navigate = useNavigate(),
    mutation = useMutation(),
    scene = ["/", "/directory"].includes(location.pathname);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-seal">三</span>
          <span>
            SANTAISHI-TEI<small>JAPANESE KITCHEN</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/directory">The house</Link>
          <Link to="/menu">Dining room</Link>
          {user ? (
            <>
              <Link to="/kitchen">Kitchen</Link>
              {user.role === "admin" && <Link to="/admin">Office</Link>}
              <span className="staff-name">
                {user.displayName}
                <small>{user.role}</small>
              </span>
              <button
                className="text-button"
                onClick={async () => {
                  if (await mutation.run(sessionApi.logout)) {
                    setUser(null);
                    navigate("/");
                  }
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login">Staff entrance ↗</Link>
          )}
        </nav>
      </header>
      <main id="main" className={scene ? "scene-main" : "content-main"}>
        <ErrorNotice error={mutation.error} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/menu/:slug" element={<DishDetail />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/kitchen"
            element={
              <Guard>
                <Kitchen />
              </Guard>
            }
          />
          <Route
            path="/kitchen/dishes/new"
            element={
              <Guard>
                <CatalogEditor kind="dish" />
              </Guard>
            }
          />
          <Route
            path="/kitchen/dishes/:id/edit"
            element={
              <Guard>
                <CatalogEditor kind="dish" />
              </Guard>
            }
          />
          <Route
            path="/kitchen/dishes/:id/recipe"
            element={
              <Guard>
                <Recipe />
              </Guard>
            }
          />
          <Route
            path="/kitchen/ingredients"
            element={
              <Guard>
                <Pantry />
              </Guard>
            }
          />
          <Route
            path="/kitchen/ingredients/new"
            element={
              <Guard admin>
                <CatalogEditor kind="ingredient" />
              </Guard>
            }
          />
          <Route
            path="/kitchen/ingredients/:id/edit"
            element={
              <Guard admin>
                <CatalogEditor kind="ingredient" />
              </Guard>
            }
          />
          <Route
            path="/kitchen/ingredients/:id"
            element={
              <Guard>
                <Ledger />
              </Guard>
            }
          />
          <Route
            path="/kitchen/stock/new"
            element={
              <Guard>
                <StockForm />
              </Guard>
            }
          />
          <Route
            path="/kitchen/stock-history"
            element={
              <Guard>
                <Journal />
              </Guard>
            }
          />
          <Route
            path="/admin"
            element={
              <Guard admin>
                <Office />
              </Guard>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <Guard admin>
                <Chefs />
              </Guard>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <Guard admin>
                <Categories />
              </Guard>
            }
          />
          <Route
            path="/admin/categories/new"
            element={
              <Guard admin>
                <CatalogEditor kind="category" />
              </Guard>
            }
          />
          <Route
            path="/admin/categories/:id/edit"
            element={
              <Guard admin>
                <CatalogEditor kind="category" />
              </Guard>
            }
          />
          <Route
            path="*"
            element={
              <section className="empty-state">
                <h1>Room not found.</h1>
                <Link to="/directory">Return to the house</Link>
              </section>
            }
          />
        </Routes>
      </main>
      {!scene && (
        <footer className="site-footer">
          <span>三太子亭 · Santaishi-tei</span>
          <p>Good food. Quiet moments. A place at the table.</p>
          <Link to="/directory">Return to the house ↗</Link>
        </footer>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppProvider>
      <Shell />
    </AppProvider>
  </BrowserRouter>,
);
