import { Outlet, useLocation } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";

export function StorefrontLayout() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* gold reading-progress hairline */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-brand rtl:origin-right"
      />
      <Header />
      <main className="flex-1">
        <motion.div
          key={location.pathname}
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
