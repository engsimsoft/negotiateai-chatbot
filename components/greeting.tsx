"use client";

import { motion } from "framer-motion";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";

interface UserProfile {
  displayName: string | null;
  email: string;
}

export const Greeting = () => {
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", fetcher);
  const name =
    profile?.displayName || profile?.email?.split("@")[0] || "";

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
        {name ? `Привет, ${name}!` : "Привет!"} 👋
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-lg text-muted-foreground md:text-xl mt-2"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        Чем могу помочь?
      </motion.div>
    </div>
  );
};
