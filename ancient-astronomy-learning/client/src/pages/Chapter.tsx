import { useParams } from 'wouter';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import {
  celestialBodies,
  fourSymbols,
  twentyEightMansions,
  bigDipperStars,
  chapters,

  zodiacMansions,
  mansionDetails,
  threeEnclosures,
  celestialMyths,
} from '@/lib/courseData';
import {
  sevenCelestialQuiz,
  bigDipperQuiz,
  threeEnclosuresQuiz,
  celestialMythologyQuiz,
  twentyEightMansionsQuiz,
  twelveZodiacQuiz,

  twentyEightMansionsMatching,
} from '@/lib/quizData';
import Quiz from '@/components/Quiz';
import MatchingGame from '@/components/MatchingGame';

/**
 * 章節頁面組件
 * 設計哲學：古韻現代 - 展開式卡片 + 詳細內容
 */

interface ExpandableItemProps {
  title: string;
  subtitle?: string;
  content: string[];
  quote?: string;
  color?: string;
  index: number;
}

function ExpandableItem({ title, subtitle, content, quote, color = '#d4af37', index }: ExpandableItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="knowledge-card"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between gap-4 text-left"
      >
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1" style={{ color }}>
            {title}
          </h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex-shrink-0 mt-1">
          {isExpanded ? (
            <ChevronUp className="w-6 h-6 text-accent" />
          ) : (
            <ChevronDown className="w-6 h-6 text-accent" />
          )}
        </div>
      </button>

      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{
          height: isExpanded ? 'auto' : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="pt-4 border-t border-border mt-4 space-y-3">
          {content.map((item, i) => (
            <p key={i} className="text-sm text-foreground leading-relaxed">
              • {item}
            </p>
          ))}
          {quote && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="italic text-accent text-sm">「{quote}」</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Chapter() {
  const { id } = useParams();
  
  // 檢查是否為測驗或遊戲路由
  const isQuizOrGame = id?.startsWith('quiz-') || id?.startsWith('matching-');
  const chapter = isQuizOrGame ? null : chapters.find((c) => c.id === id);

  if (!isQuizOrGame && !chapter) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-accent mb-4">章節未找到</h1>
          <Link href="/">
            <span className="text-accent hover:text-gold-light transition-colors cursor-pointer">
              返回首頁
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // 如果是測驗或遊戲，直接渲染
    if (isQuizOrGame) {
      switch (id) {
        case 'quiz-seven-celestial':
          return <Quiz {...sevenCelestialQuiz} />;
        case 'quiz-big-dipper':
          return <Quiz {...bigDipperQuiz} />;
        case 'quiz-three-enclosures':
          return <Quiz {...threeEnclosuresQuiz} />;
        case 'quiz-celestial-mythology':
          return <Quiz {...celestialMythologyQuiz} />;
        case 'quiz-twenty-eight-mansions':
          return <Quiz {...twentyEightMansionsQuiz} />;
        case 'quiz-twelve-zodiac':
          return <Quiz {...twelveZodiacQuiz} />;

        case 'matching-four-symbols':
          return <MatchingGame {...twentyEightMansionsMatching} />;
        default:
          return <div>未知的測驗或遊戲</div>;
      }
    }

    // 否則渲染章節內容
    switch (id) {
      case 'seven-celestial':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">七曜與五星</h2>
              <p className="text-foreground leading-relaxed mb-4">
                古人把日、月和金、木、水、火、土五星合起來稱為七曜或七政。這七個天體在古代被認為是最重要的天體，掌管著時間、季節和人類的命運。
              </p>
              <p className="text-foreground leading-relaxed">
                每一顆星都有其特殊的含義和文化象徵，被廣泛應用於曆法、占卜、政治決策等各個領域。
              </p>
            </motion.div>

            <div className="space-y-4">
              {celestialBodies.map((body, index) => (
                <ExpandableItem
                  key={body.id}
                  title={body.chineseName}
                  subtitle={body.name}
                  content={body.details}
                  quote={body.historicalQuote}
                  color={body.color}
                  index={index}
                />
              ))}
            </div>

            {/* 測驗按鈕 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mt-12 p-6 bg-accent/10 border-2 border-accent rounded-lg text-center"
            >
              <p className="text-foreground mb-4">學完了嗎？來測試一下你的理解吧！</p>
              <Link href="/chapter/quiz-seven-celestial">
                <span className="inline-block px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer">
                  參加測驗
                </span>
              </Link>
            </motion.div>
          </div>
        );

      case 'four-symbols':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">四象與四靈</h2>
              <p className="text-foreground leading-relaxed mb-4">
                青龍、白虎、玄武、朱雀四大神獸分別代表東、西、北、南四個方向，對應春、秋、冬、夏四季，以及木、金、水、火四種元素。
              </p>
              <p className="text-foreground leading-relaxed">
                這四象系統在中國古代的城市規劃、建築設計、軍事戰略等多個領域都有廣泛應用。
              </p>
            </motion.div>

            {/* 四象圖示 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8 text-center"
            >
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663284379141/5EsFKuHcvbomTUf4kwmv75/four-symbols-pattern-dGZAewmGC8mCkWzzDmRxHp.webp"
                alt="四象圖"
                className="w-full max-w-md mx-auto rounded-lg"
              />
              <p className="text-sm text-muted-foreground mt-4">四象與四靈 - 傳統圖示</p>
            </motion.div>

            <div className="space-y-4">
              {fourSymbols.map((symbol, index) => (
                <ExpandableItem
                  key={symbol.id}
                  title={symbol.chineseName}
                  subtitle={`${symbol.direction}方 · ${symbol.element}元素`}
                  content={symbol.details}
                  color={symbol.color}
                  index={index}
                />
              ))}
            </div>

            {/* 測驗與連線遊戲按鈕 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="p-6 bg-accent/10 border-2 border-accent rounded-lg text-center">
                <p className="text-foreground mb-4">測試你對四象的理解</p>
                <Link href="/chapter/quiz-four-symbols">
                  <span className="inline-block px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer">
                    參加測驗
                  </span>
                </Link>
              </div>
              <div className="p-6 bg-accent/10 border-2 border-accent rounded-lg text-center">
                <p className="text-foreground mb-4">與星宿連線配對</p>
                <Link href="/chapter/matching-twenty-eight">
                  <span className="inline-block px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer">
                    開始遊戲
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        );

      case 'twenty-eight':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">二十八星宿</h2>
              <p className="text-foreground leading-relaxed mb-4">
                二十八星宿十分類似於西方的黃道十二宮，它們是黃道和白道附近的二十八個區域，為日月五星所經之處。
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                「宿」意為「房子」，月亮每晚停留在不同的星宿，就像在不同的房子裡住宿。
              </p>
              <p className="text-foreground leading-relaxed">
                二十八宿與四象的對應關係，是以古代某一時期春分黃昏時分的天空為依據的。此時朱雀在南，青龍在東，玄武在北，白虎在西。
              </p>
            </motion.div>

            {/* 四象與二十八宿總覽表格 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-6 mb-8 overflow-x-auto"
            >
              <h3 className="text-xl font-bold text-accent mb-4">四象與二十八宿總覽 <span className="text-sm font-normal text-muted-foreground">(Four Symbols & Twenty-eight Mansions)</span></h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 text-left text-muted-foreground font-semibold">四象</th>
                    <th className="p-3 text-left text-muted-foreground font-semibold">方位</th>
                    <th className="p-3 text-left text-muted-foreground font-semibold">七宿</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-bold" style={{ color: '#00AA00' }}>青龍<br/><span className="text-xs font-normal text-muted-foreground">Azure Dragon</span></td>
                    <td className="p-3 text-foreground">東</td>
                    <td className="p-3 text-foreground">
                      角（jiǎo）Horn、亢（kàng）Neck、氐（dī）Root、<br/>
                      房（fáng）Room、心（xīn）Heart、尾（wěi）Tail、<br/>
                      箕（jī）Winnowing-basket
                    </td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-bold" style={{ color: '#6699CC' }}>玄武<br/><span className="text-xs font-normal text-muted-foreground">Murky Warrior</span></td>
                    <td className="p-3 text-foreground">北</td>
                    <td className="p-3 text-foreground">
                      斗（dǒu）Dipper、牛（niú）Ox、女（nǚ）Girl、<br/>
                      虛（xū）Emptiness、危（wēi）Rooftop、<br/>
                      室（shì）Encampment、壁（bì）Wall
                    </td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-bold" style={{ color: '#C0C0C0' }}>白虎<br/><span className="text-xs font-normal text-muted-foreground">White Tiger</span></td>
                    <td className="p-3 text-foreground">西</td>
                    <td className="p-3 text-foreground">
                      奎（kuí）Legs、婁（lóu）Bond、胃（wèi）Stomach、<br/>
                      昴（mǎo）Hairy head、畢（bì）Net、<br/>
                      觜（zī）Turtle beak、參（shēn）Three stars
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold" style={{ color: '#FF4444' }}>朱雀<br/><span className="text-xs font-normal text-muted-foreground">Vermilion Bird</span></td>
                    <td className="p-3 text-foreground">南</td>
                    <td className="p-3 text-foreground">
                      井（jǐng）Well、鬼（guǐ）Ghosts、柳（liǔ）Willow、<br/>
                      星（xīng）Star、張（zhāng）Extended net、<br/>
                      翼（yì）Wings、軫（zhěn）Chariot
                    </td>
                  </tr>
                </tbody>
              </table>
            </motion.div>

            {/* 按四象分類顯示星宿 */}
            {['東方', '北方', '西方', '南方'].map((direction: string) => {
              const filteredMansions = twentyEightMansions.filter((m: any) => m.direction === direction);
              const directionMap: Record<string, { name: string; engName: string; color: string; short: string }> = {
                '東方': { name: '青龍', engName: 'Azure Dragon', color: '#00AA00', short: '東' },
                '西方': { name: '白虎', engName: 'White Tiger', color: '#C0C0C0', short: '西' },
                '北方': { name: '玄武', engName: 'Murky Warrior', color: '#6699CC', short: '北' },
                '南方': { name: '朱雀', engName: 'Vermilion Bird', color: '#FF4444', short: '南' },
              };
              const dirInfo = directionMap[direction];

              return (
                <motion.div
                  key={direction}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className="bg-card border border-border rounded-lg p-6 mb-6"
                >
                  <h3 className="text-xl font-bold mb-4" style={{ color: dirInfo.color }}>
                    {dirInfo.short}方 · {dirInfo.name}七宿 <span className="text-sm font-normal text-muted-foreground">({dirInfo.engName})</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {filteredMansions.map((mansion: any) => (
                      <div
                        key={mansion.id}
                        className="bg-night-sky-lighter rounded-lg p-3 text-center border border-border/50 hover:border-accent transition-colors"
                      >
                        <p className="text-lg font-bold text-accent">{mansion.chineseName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{mansion.name}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}

            {/* 參商故事 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mt-8"
            >
              <h3 className="text-xl font-bold text-accent mb-4">參商故事</h3>
              <p className="text-foreground leading-relaxed mb-4">
                參宿即西方的獵戶座。相傳遠古的高辛氏有二個兒子，大子為閼伯，次子為實沈，他們雖為兄弟，卻水火不容，經常鬥毆不息。
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                高辛氏無奈，唯有把閼伯遷於商丘，實沈則遷於大夏。兩兄弟後來分別祭祀參商二星，這兩星就如他們一樣，各分東西，此出彼沒，永不相見。
              </p>
              <p className="text-foreground leading-relaxed italic text-accent">
                「人生不相見，動如參與商」
              </p>
            </motion.div>

            {/* 測驗按鈕 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mt-12 p-6 bg-accent/10 border-2 border-accent rounded-lg text-center"
            >
              <p className="text-foreground mb-4">你已經深入了解了二十八星宿。來測試一下吧！</p>
              <Link href="/chapter/quiz-twenty-eight-mansions">
                <span className="inline-block px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer">
                  參加測驗
                </span>
              </Link>
            </motion.div>
          </div>
        );

      case 'big-dipper':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">北斗七星</h2>
              <p className="text-foreground leading-relaxed mb-4">
                北斗七星是北方天空中最著名的星群，由七顆亮星組成，形狀像一個斗。
              </p>
              <p className="text-foreground leading-relaxed">
                古人用北斗七星來指示季節變化，並以其位置確定方向。北斗的斗柄指向不同的方向時，代表不同的季節。
              </p>
            </motion.div>

            {/* 北斗七星命名 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-6 mb-6"
            >
              <h3 className="text-xl font-bold text-accent mb-4">北斗七星命名</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bigDipperStars.map((star: any, index: number) => (
                  <div key={index} className="bg-night-sky-lighter rounded-lg p-4 border border-border/50">
                    <p className="text-lg font-bold text-accent">{star.name}</p>
                    <p className="text-sm text-muted-foreground">{star.pinyin}</p>
                    <p className="text-sm text-foreground mt-2">{star.position}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 季節指示 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8"
            >
              <h3 className="text-xl font-bold text-accent mb-4">北斗與四季</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🌱</div>
                  <div>
                    <p className="font-semibold text-foreground">春季</p>
                    <p className="text-sm text-muted-foreground">斗柄東指，天下皆春</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">☀️</div>
                  <div>
                    <p className="font-semibold text-foreground">夏季</p>
                    <p className="text-sm text-muted-foreground">斗柄南指，天下皆夏</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🍂</div>
                  <div>
                    <p className="font-semibold text-foreground">秋季</p>
                    <p className="text-sm text-muted-foreground">斗柄西指，天下皆秋</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">❄️</div>
                  <div>
                    <p className="font-semibold text-foreground">冬季</p>
                    <p className="text-sm text-muted-foreground">斗柄北指，天下皆冬</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="italic text-accent text-sm">
                  《史記·天官書》：「直斗杓所指，以建時節。」
                </p>
              </div>
            </motion.div>

            {/* 天極與北極星 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mt-6"
            >
              <h3 className="text-xl font-bold text-accent mb-4">天極與北極星</h3>
              <p className="text-foreground leading-relaxed mb-4">
                天極是天球的最高點，古時候稱為【太一】【東皇太一】【天帝】【勾陳一】。
              </p>
              <p className="text-foreground leading-relaxed">
                北極星是距離天極最近的亮星，它幾乎不動，因此被古人用作方向指示。北斗七星圍繞北極星旋轉，形成了天空中最穩定的參考點。
              </p>
            </motion.div>

            {/* 測驗按鈕 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mt-12 p-6 bg-accent/10 border-2 border-accent rounded-lg text-center"
            >
              <p className="text-foreground mb-4">你已經深入了解了北斗七星。來測試一下吧！</p>
              <Link href="/chapter/quiz-big-dipper">
                <span className="inline-block px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer">
                  參加測驗
                </span>
              </Link>
            </motion.div>
          </div>
        );

      case 'three-enclosures':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">三垣</h2>
              <p className="text-foreground leading-relaxed mb-4">
                三垣是古代天文分區系統中最高級的分類，代表了古人對整個天球的系統認識。三垣分別象徵天上的不同領域：紫微垣代表天帝的宮殿，太微垣代表朝代的政治中心，天市垣代表人間的市場。
              </p>
            </motion.div>

            {threeEnclosures.map((enclosure, index) => (
              <ExpandableItem
                key={enclosure.id}
                title={enclosure.name}
                subtitle={`拼音：${enclosure.pinyin}`}
                content={[
                  `位置：${enclosure.location}`,
                  `主要星官：${enclosure.mainStars.join('、')}`,
                  `文化意義：${enclosure.significance}`,
                  `神話背景：${enclosure.mythology}`
                ]}
                index={index}
              />
            ))}

            {/* 測驗按鈕 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mt-12 p-6 bg-accent/10 border-2 border-accent rounded-lg text-center"
            >
              <p className="text-foreground mb-4">你已經了解了三垣的奧秘。來測試一下吧！</p>
              <Link href="/chapter/quiz-three-enclosures">
                <span className="inline-block px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer">
                  參加測驗
                </span>
              </Link>
            </motion.div>
          </div>
        );

      case 'celestial-mythology':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">星空神話</h2>
              <p className="text-foreground leading-relaxed mb-4">
                星辰背後蘊含著豐富的文化意義和古老的神話故事。這些故事不僅解釋了天體的起源，也反映了古人對宇宙、時間和人生的深刻思考。
              </p>
            </motion.div>

            {celestialMyths.map((myth, index) => (
              <ExpandableItem
                key={myth.id}
                title={myth.title}
                subtitle={`分類：${myth.category}`}
                content={[
                  myth.content,
                  `相關星辰：${myth.relatedStars.join('、')}`,
                  `文化意義：${myth.culturalSignificance}`
                ]}
                index={index}
              />
            ))}

            {/* 測驗按鈕 */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mt-12 p-6 bg-accent/10 border-2 border-accent rounded-lg text-center"
            >
              <p className="text-foreground mb-4">你已經領略了星空神話的魅力。來測試一下吧！</p>
              <Link href="/chapter/quiz-celestial-mythology">
                <span className="inline-block px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer">
                  參加測驗
                </span>
              </Link>
            </motion.div>
          </div>
        );

      case 'classroom-project':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">課堂任務</h2>
              <p className="text-foreground leading-relaxed mb-4">
                本領域課任務：兩人為一組
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8"
            >
              <h3 className="text-xl font-bold text-accent mb-4">任務一：星漢燒爛</h3>
              <p className="text-foreground leading-relaxed mb-4">
                用墨汁塗黑箱子內四周及頂部。
              </p>
              <p className="text-sm text-muted-foreground">這個項目是一個粗程的天文觀測裝置，粗程地模擬了古代人類寶貴的天文觀測寶寶。</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8"
            >
              <h3 className="text-xl font-bold text-accent mb-4">任務二：製作海報</h3>
              <p className="text-foreground leading-relaxed mb-4">結合所學知識並蒐集資料製作海報，主題三選一：</p>
              <div className="space-y-3 mt-4">
                <div className="border-l-4 border-accent pl-4">
                  <p className="font-semibold text-accent mb-2">海報主題選項：</p>
                  <ul className="text-foreground space-y-1 text-sm">
                    <li>• 五星七曜</li>
                    <li>• 四象北斗七星</li>
                    <li>• 二十八宿</li>
                    <li>• 十二星次</li>
                  </ul>
                </div>
                <div className="border-l-4 border-accent pl-4">
                  <p className="font-semibold text-accent mb-2">海報內容包括：</p>
                  <ul className="text-foreground space-y-1 text-sm">
                    <li>• 主題簡介</li>
                    <li>• 基礎知識</li>
                    <li>• 相關圖片</li>
                    <li>• 藝術設計（配色、字體）</li>
                  </ul>
                </div>
                <div className="border-l-4 border-accent pl-4">
                  <p className="font-semibold text-accent mb-2">製作方式：</p>
                  <p className="text-foreground text-sm">每組一個主題，在白板裡共同製作。</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-accent/10 border-2 border-accent rounded-lg p-8 text-center"
            >
              <p className="text-foreground mb-2">課堂任務是一個很好的學習機會，透過動手實踐來深化你的理解。</p>
              <p className="text-sm text-muted-foreground">上傳你的作品，與同學分享你的古代天文知識！</p>
            </motion.div>
          </div>
        );

      case 'twelve-zodiac':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-lg p-8 mb-8"
            >
              <h2 className="text-2xl font-bold text-accent mb-4">十二星次</h2>
              <p className="text-foreground leading-relaxed mb-4">
                黃道十二宮是中國古代天文中的一個重要概念。它對應了西方的十二星座，並與四象、季節和節氣密切相關。
              </p>
              <p className="text-foreground leading-relaxed">
                每一個星次都有其特殊的特性和文化意義，反映了古人對天體變化的深入理解。
              </p>
            </motion.div>

            <div className="space-y-4">
              {zodiacMansions.map((zodiac, index) => (
                <ExpandableItem
                  key={zodiac.id}
                  title={zodiac.name}
                  subtitle={`${zodiac.symbol}`}
                  content={[
                    `拼音：${zodiac.pinyin}`,
                    `對應星宿：${zodiac.mansions.join('、')}`,
                    `地支：${zodiac.earthlyBranch}`,
                    `對應星座：${zodiac.modernConstellation}`,
                    `節氣：${zodiac.startingJieqi}`,
                    `${zodiac.description}`
                  ]}
                  color="#d4af37"
                  index={index}
                />
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 頂部導航 */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 text-accent hover:text-gold-light transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
              返回首頁
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-accent" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            {isQuizOrGame ? '測驗與遊戲' : chapter?.chineseTitle}
          </h1>
          <div className="w-20" />
        </div>
      </div>

      {/* 內容區域 */}
      <section className="py-12">
        <div className="container max-w-4xl">
          {renderContent()}
        </div>
      </section>

      {/* 頁腳 */}
      <footer className="py-12 border-t border-border bg-night-sky-light/30 mt-12">
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
