import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, RotateCcw } from 'lucide-react';
import { MatchingPair } from '@/lib/quizData';

interface MatchingGameProps {
  title: string;
  description: string;
  pairs: MatchingPair[];
}

interface Match {
  leftId: string;
  rightId: string;
}

/**
 * 連線遊戲組件
 * 設計哲學：古韻現代 - 互動式學習
 */

export default function MatchingGame({ title, description, pairs }: MatchingGameProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [completed, setCompleted] = useState(false);

  // 打亂右側選項順序
  const [rightItems] = useState(() => {
    const items = pairs.map((p) => ({ id: p.id, text: p.right }));
    return items.sort(() => Math.random() - 0.5);
  });

  const leftItems = pairs.map((p) => ({ id: p.id, text: p.left }));

  // 檢查是否完成
  useEffect(() => {
    if (matches.length === pairs.length) {
      const allCorrect = matches.every((match) => {
        const pair = pairs.find((p) => p.id === match.leftId);
        return pair && rightItems.find((r) => r.id === match.rightId)?.id === pair.id;
      });
      if (allCorrect) {
        setCompleted(true);
      }
    }
  }, [matches, pairs, rightItems]);

  const handleLeftClick = (id: string) => {
    const isAlreadyMatched = matches.some((m) => m.leftId === id);
    if (!isAlreadyMatched) {
      setSelectedLeft(id);
    }
  };

  const handleRightClick = (rightId: string) => {
    if (selectedLeft) {
      // 檢查右側是否已被配對
      const isAlreadyMatched = matches.some((m) => m.rightId === rightId);
      if (!isAlreadyMatched) {
        // 檢查是否正確配對
        const leftPair = pairs.find((p) => p.id === selectedLeft);
        const rightPair = rightItems.find((r) => r.id === rightId);
        if (leftPair && rightPair && leftPair.id === rightPair.id) {
          setMatches([...matches, { leftId: selectedLeft, rightId }]);
        }
      }
      setSelectedLeft(null);
    }
  };

  const handleRemoveMatch = (leftId: string) => {
    setMatches(matches.filter((m) => m.leftId !== leftId));
  };

  const handleReset = () => {
    setSelectedLeft(null);
    setMatches([]);
    setCompleted(false);
  };

  const progress = (matches.length / pairs.length) * 100;

  if (completed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-lg p-8 text-center"
      >
        <motion.div
          className="mb-6"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5 }}
        >
          <CheckCircle className="w-20 h-20 mx-auto text-accent" />
        </motion.div>

        <h3 className="text-3xl font-bold text-accent mb-4">完美配對！</h3>

        <p className="text-foreground mb-8">
          恭喜你成功完成了所有配對。你對這些知識點的理解很不錯！
        </p>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
          重新開始
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-lg p-8"
    >
      {/* 標題 */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-accent mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>

        {/* 進度條 */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-border rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-accent h-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {matches.length} / {pairs.length}
          </span>
        </div>
      </div>

      {/* 連線區域 */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* 左側 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground mb-4">點擊左側項目</p>
          <AnimatePresence>
            {leftItems.map((item) => {
              const isSelected = selectedLeft === item.id;
              const isMatched = matches.some((m) => m.leftId === item.id);
              const matchedRight = matches.find((m) => m.leftId === item.id)?.rightId;

              return (
                <motion.div key={item.id} layout>
                  <motion.button
                    onClick={() => handleLeftClick(item.id)}
                    disabled={isMatched}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isMatched
                        ? 'border-green-500 bg-green-500/10 cursor-default'
                        : isSelected
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50 cursor-pointer'
                    }`}
                    whileHover={!isMatched ? { x: 4 } : {}}
                    whileTap={!isMatched ? { scale: 0.98 } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-semibold">{item.text}</span>
                      {isMatched && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>
                    {isMatched && matchedRight && (
                      <p className="text-xs text-green-400 mt-1">
                        已配對：{rightItems.find((r) => r.id === matchedRight)?.text}
                      </p>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* 右側 */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground mb-4">點擊右側項目配對</p>
          <AnimatePresence>
            {rightItems.map((item) => {
              const isMatched = matches.some((m) => m.rightId === item.id);
              const matchedLeft = matches.find((m) => m.rightId === item.id)?.leftId;

              return (
                <motion.div key={item.id} layout>
                  <motion.button
                    onClick={() => handleRightClick(item.id)}
                    disabled={isMatched || !selectedLeft}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isMatched
                        ? 'border-green-500 bg-green-500/10 cursor-default'
                        : selectedLeft && !isMatched
                        ? 'border-accent/50 hover:border-accent cursor-pointer'
                        : 'border-border cursor-not-allowed opacity-50'
                    }`}
                    whileHover={!isMatched && selectedLeft ? { x: -4 } : {}}
                    whileTap={!isMatched && selectedLeft ? { scale: 0.98 } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-semibold">{item.text}</span>
                      {isMatched && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>
                    {isMatched && matchedLeft && (
                      <p className="text-xs text-green-400 mt-1">
                        已配對：{leftItems.find((l) => l.id === matchedLeft)?.text}
                      </p>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* 提示 */}
      {selectedLeft && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-night-sky-lighter rounded-lg border border-accent/50 mb-8"
        >
          <p className="text-sm text-accent">
            已選擇：<span className="font-semibold">{leftItems.find((l) => l.id === selectedLeft)?.text}</span>
            ，現在點擊右側對應的項目
          </p>
        </motion.div>
      )}

      {/* 按鈕 */}
      <div className="flex gap-4">
        <button
          onClick={handleReset}
          className="flex-1 px-6 py-3 border-2 border-accent text-accent font-semibold rounded-lg hover:bg-accent/10 transition-colors"
        >
          <RotateCcw className="w-5 h-5 inline mr-2" />
          重新開始
        </button>
      </div>
    </motion.div>
  );
}
