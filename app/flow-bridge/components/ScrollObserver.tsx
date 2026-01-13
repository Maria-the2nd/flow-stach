"use client";
import { useEffect } from "react";

export default function ScrollObserver() {
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("fb-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        const sections = document.querySelectorAll("section");
        sections.forEach((section) => {
            section.classList.add("fb-reveal");
            observer.observe(section);
        });

        return () => observer.disconnect();
    }, []);

    return null;
}
