import { motion } from 'framer-motion';

interface GreetingProps {
  documentTitle?: string;
}

export const Greeting = ({ documentTitle }: GreetingProps) => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
        className="text-2xl font-semibold"
      >
        Hey there!
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-2xl text-zinc-500"
      >
        {documentTitle
          ? `I see you are reading ${documentTitle}, what can I help you with?`
          : 'What can I help you with?'}
      </motion.div>
    </div>
  );
};
