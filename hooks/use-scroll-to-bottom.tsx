import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

type ScrollFlag = ScrollBehavior | false;

export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { data: scrollBehavior = false, mutate: setScrollBehavior } =
    useSWR<ScrollFlag>("messages:should-scroll", null, { fallbackData: false });

  const handleScroll = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    // With flex-direction: column-reverse, scrollTop=0 means "at the bottom" (newest).
    // Scrolling up gives negative scrollTop values.
    const { scrollTop } = containerRef.current;
    setIsAtBottom(scrollTop >= -100);
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        handleScroll();
      });
    });

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleScroll();
        });
      });
    });

    resizeObserver.observe(container);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-state"],
    });

    handleScroll();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [handleScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial state

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (scrollBehavior && containerRef.current) {
      const container = containerRef.current;
      // With column-reverse, "bottom" (newest) is scrollTop=0
      container.scrollTo({ top: 0, behavior: scrollBehavior });
      setScrollBehavior(false);
    }
  }, [scrollBehavior, setScrollBehavior]);

  const scrollToBottom = useCallback(
    (currentScrollBehavior: ScrollBehavior = "smooth") => {
      setScrollBehavior(currentScrollBehavior);
    },
    [setScrollBehavior]
  );

  function onViewportEnter() {
    setIsAtBottom(true);
  }

  function onViewportLeave() {
    setIsAtBottom(false);
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  };
}
