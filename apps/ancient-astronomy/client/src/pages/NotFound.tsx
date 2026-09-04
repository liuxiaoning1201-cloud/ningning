import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Home, Star } from 'lucide-react';

/**
 * 404 Not Found 頁面
 * 設計哲學：古韻現代 - 簡潔優雅
 */

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mb-8"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity as any, ease: 'linear' }}
        >
          <Star className="w-24 h-24 mx-auto text-accent" />
        </motion.div>

        <h1 className="text-6xl font-bold text-accent mb-4" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          404
        </h1>

        <p className="text-2xl text-foreground mb-2">頁面未找到</p>

        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          抱歉，您訪問的頁面似乎在星空中迷失了。讓我們帶您回到正確的方向。
        </p>

        <Link href="/">
          <a className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors">
            <Home className="w-5 h-5" />
            返回首頁
          </a>
        </Link>
      </motion.div>
    </div>
  );
}
