import React, { useEffect, useRef } from 'react';

interface WordRevealProps {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children: string;
}

/**
 * Reproduces the drafts' `.word-reveal` scroll-in animation: splits text into
 * per-word spans that fade in staggered as the element enters the viewport.
 */
export default function WordReveal({ as: Tag = 'h2', className, children }: WordRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = el.querySelectorAll('span');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            spans.forEach((span, i) => {
              setTimeout(() => span.classList.add('active'), i * 50);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  const words = children.split(' ');

  return (
    // @ts-expect-error dynamic tag ref typing
    <Tag ref={ref} className={`word-reveal ${className ?? ''}`}>
      {words.map((word, i) => (
        <span key={i}>{word}</span>
      ))}
    </Tag>
  );
}
