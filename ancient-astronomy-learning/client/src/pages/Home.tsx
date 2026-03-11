import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { chapters } from '@/lib/courseData';
import { Star, BookOpen, Sparkles } from 'lucide-react';

/**
 * 首頁組件
 * 設計哲學：古韻現代 - 深色夜空背景 + 金色星辰點綴
 * 特色：星圖英雄區 + 課程卡片網格 + 流暢動畫
 */

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 英雄區 - 星圖背景 */}
      <section 
        className="relative h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'url(https://d2xsxph8kpxj0f.cloudfront.net/310519663284379141/5EsFKuHcvbomTUf4kwmv75/hero-starmap-FyhdJoe8WmnD6Pf9mxJp8y.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* 深色遮罩層 */}
        <div className="absolute inset-0 bg-black/40" />
        
        {/* 星辰點綴動畫 */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-300 rounded-full animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity as any,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* 內容 */}
        <motion.div 
          className="relative z-10 text-center px-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-6">
            <Sparkles className="w-16 h-16 mx-auto text-accent animate-glow" />
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-5xl md:text-7xl font-bold mb-4 text-accent"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            古代天文
          </motion.h1>

          <motion.p 
            variants={itemVariants}
            className="text-xl md:text-2xl text-star-light mb-8 max-w-2xl mx-auto"
          >
            探索星辰的奧秘，理解古人如何觀察天空、認識宇宙
          </motion.p>

          <motion.p 
            variants={itemVariants}
            className="text-lg text-star-muted mb-12 italic"
          >
            「人生不相見，動如參與商」
          </motion.p>

          <motion.div 
            variants={itemVariants}
            className="flex gap-4 justify-center flex-wrap"
          >
            <a 
              href="#chapters"
              className="px-8 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors"
            >
              開始學習
            </a>
            <a 
              href="#about"
              className="px-8 py-3 border-2 border-accent text-accent font-semibold rounded-lg hover:bg-accent/10 transition-colors"
            >
              了解更多
            </a>
          </motion.div>
        </motion.div>

        {/* 向下箭頭 */}
        <motion.div 
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="text-accent text-3xl">↓</div>
        </motion.div>
      </section>

      {/* 課程章節 */}
      <section id="chapters" className="py-20">
        <div className="container">
          <motion.h2 
            className="text-4xl font-bold text-center mb-16 text-accent"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            完整課程
          </motion.h2>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {chapters.map((chapter) => (
              <Link key={chapter.id} href={`/chapter/${chapter.id}`}>
                <motion.div
                  variants={itemVariants}
                  className="knowledge-card group hover:shadow-lg cursor-pointer"
                >
                  <div className="text-5xl mb-4">{chapter.icon}</div>
                  <h3 className="text-2xl font-bold text-accent mb-3">
                    {chapter.chineseTitle}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {chapter.description}
                  </p>
                  <div className="inline-flex items-center gap-2 text-accent group-hover:text-gold-light transition-colors font-semibold">
                    <BookOpen className="w-4 h-4" />
                    進入課程
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 關於本課程 */}
      <section id="about" className="py-20 bg-night-sky-light/50 border-t border-border">
        <div className="container max-w-3xl">
          <motion.h2 
            className="text-4xl font-bold text-center mb-12 text-accent"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            關於古代天文
          </motion.h2>

          <motion.div 
            className="space-y-6 text-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <p className="text-lg leading-relaxed">
              古代天文學是中國傳統文化的重要組成部分。從遠古時代開始，人們就開始觀察天空，尋找規律，用於指導農業生產、制定曆法、進行政治決策。
            </p>

            <div className="bg-card border border-border rounded-lg p-6 my-8">
              <p className="text-accent font-semibold mb-2 italic">
                「隋唐時期的《丹元子步天歌》將全天星官分歸『三垣二十八宿』統轄，此後一直沿用1000余年。」
              </p>
            </div>

            <p className="text-lg leading-relaxed">
              本課程通過學習七曜、四象、二十八星宿等古代天文知識，幫助學生理解：
            </p>

            <ul className="space-y-3 ml-6">
              <li className="flex gap-3">
                <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                <span>古人如何觀察和分類天體</span>
              </li>
              <li className="flex gap-3">
                <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                <span>天文知識與文化、政治、農業的關係</span>
              </li>
              <li className="flex gap-3">
                <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                <span>傳統天文知識體系的科學性和藝術性</span>
              </li>
              <li className="flex gap-3">
                <Star className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                <span>如何將古代知識應用到現代學習中</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* 頁腳 */}
      <footer className="py-12 border-t border-border bg-night-sky-light/30">
        <div className="container text-center text-muted-foreground">
          <p className="mb-2">古代天文文化學習網站</p>
          <p className="text-sm">
            探索星辰，領悟古人的智慧 ✨
          </p>
        </div>
      </footer>
    </div>
  );
}
