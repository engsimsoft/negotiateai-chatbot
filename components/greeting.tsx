import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-xl md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        Приветствую, Ольга! Теперь я помню всё.
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-500 md:text-2xl mt-2"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        Мы перешли на Gemini 3 Pro с огромным контекстным окном. Больше никаких «тормозов» и забывчивости в длинных диалогах — работайте комфортно, я удержу все детали.
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-base text-zinc-400 md:text-lg mt-6 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.7 }}
      >
        💡 <strong>Совет:</strong> Следите за индикатором токенов (справа внизу). 
        Хотя памяти теперь очень много, для максимальной скорости старайтесь не превышать <strong>80%</strong>. 
        Если подойдете к этому пределу — просто начните новый чат, чтобы я продолжал «летать»!
      </motion.div>
    </div>
  );
};
