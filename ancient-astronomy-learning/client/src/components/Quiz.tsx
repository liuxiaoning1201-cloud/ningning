import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { QuizQuestion } from '@/lib/quizData';

interface QuizProps {
  title: string;
  description: string;
  questions: QuizQuestion[];
}

/**
 * 測驗組件
 * 設計哲學：古韻現代 - 互動式學習
 */

export default function Quiz({ title, description, questions }: QuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const question = questions[currentQuestion];
  const isAnswered = answers[currentQuestion] !== undefined;
  const correctCount = answers.filter((ans, idx) => ans === questions[idx].correctAnswer).length;
  const progress = ((currentQuestion + (isAnswered ? 1 : 0)) / questions.length) * 100;

  const handleSelectAnswer = (index: number) => {
    if (!isAnswered) {
      setSelectedAnswer(index);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer !== null) {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = selectedAnswer;
      setAnswers(newAnswers);

      if (currentQuestion < questions.length - 1) {
        setTimeout(() => {
          setCurrentQuestion(currentQuestion + 1);
          setSelectedAnswer(null);
        }, 1000);
      } else {
        setShowResults(true);
      }
    }
  };

  const handleReset = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setSelectedAnswer(null);
  };

  if (showResults) {
    const percentage = Math.round((correctCount / questions.length) * 100);
    const passed = percentage >= 60;

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
          {passed ? (
            <CheckCircle className="w-20 h-20 mx-auto text-accent" />
          ) : (
            <XCircle className="w-20 h-20 mx-auto text-red-400" />
          )}
        </motion.div>

        <h3 className="text-3xl font-bold text-accent mb-4">
          {passed ? '恭喜！' : '再加油！'}
        </h3>

        <p className="text-2xl text-foreground mb-6">
          你的成績：<span className="text-accent font-bold">{percentage}%</span>
        </p>

        <div className="bg-night-sky-lighter rounded-lg p-6 mb-8">
          <p className="text-foreground mb-4">
            答對 <span className="text-accent font-bold">{correctCount}</span> / <span className="text-accent font-bold">{questions.length}</span> 題
          </p>
          <div className="w-full bg-border rounded-full h-3 overflow-hidden">
            <motion.div
              className="bg-accent h-full"
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>

        {!passed && (
          <p className="text-muted-foreground mb-8">
            建議你再次閱讀課程內容，然後重新參加測驗。
          </p>
        )}

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
            {currentQuestion + 1} / {questions.length}
          </span>
        </div>
      </div>

      {/* 問題 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <h4 className="text-xl font-semibold text-foreground mb-6">
            {question.question}
          </h4>

          {/* 選項 */}
          <div className="space-y-3 mb-8">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === question.correctAnswer;
              const showCorrect = isAnswered && isCorrect;
              const showIncorrect = isAnswered && isSelected && !isCorrect;

              return (
                <motion.button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={isAnswered}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    showCorrect
                      ? 'border-green-500 bg-green-500/10'
                      : showIncorrect
                      ? 'border-red-500 bg-red-500/10'
                      : isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-accent/50'
                  } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                  whileHover={!isAnswered ? { x: 4 } : {}}
                  whileTap={!isAnswered ? { scale: 0.98 } : {}}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        showCorrect
                          ? 'border-green-500 bg-green-500'
                          : showIncorrect
                          ? 'border-red-500 bg-red-500'
                          : isSelected
                          ? 'border-accent bg-accent'
                          : 'border-border'
                      }`}
                    >
                      {(showCorrect || showIncorrect || isSelected) && (
                        <div className="w-2 h-2 bg-background rounded-full" />
                      )}
                    </div>
                    <span className="flex-1 text-foreground">{option}</span>
                    {showCorrect && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {showIncorrect && <XCircle className="w-5 h-5 text-red-500" />}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* 解釋 */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-4 bg-night-sky-lighter rounded-lg border border-border/50"
              >
                <p className="text-sm text-muted-foreground mb-2 font-semibold">解釋：</p>
                <p className="text-sm text-foreground">{question.explanation}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 按鈕 */}
          <div className="flex gap-4">
            {!isAnswered && (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className="flex-1 px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                確認答案
              </button>
            )}
            {isAnswered && currentQuestion < questions.length - 1 && (
              <button
                onClick={() => {
                  setCurrentQuestion(currentQuestion + 1);
                  setSelectedAnswer(null);
                }}
                className="flex-1 px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors"
              >
                下一題
              </button>
            )}
            {isAnswered && currentQuestion === questions.length - 1 && (
              <button
                onClick={() => setShowResults(true)}
                className="flex-1 px-6 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-gold-light transition-colors"
              >
                查看結果
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
