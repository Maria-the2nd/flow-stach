"use client";
import { useState } from "react";

export default function FAQ() {
    const faqs = [
        { q: "Do I need to code?", a: "No. You can, but you don’t have to." },
        { q: "Does this replace Webflow?", a: "No—this feeds Webflow. Webflow is the editing superpower." },
        { q: "What AI tools do you support?", a: "Anything that outputs HTML/CSS/JS." },
        { q: "Will it be perfect every time?", a: "No. It’ll be editable every time. That’s the point." }
    ];

    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggle = (i: number) => {
        setOpenIndex(prev => prev === i ? null : i);
    };

    return (
        <section className="fb-section" id="faq">
            <div className="fb-container" style={{ maxWidth: '800px' }}>
                <h2 className="fb-h2" style={{ textAlign: 'center', marginBottom: '60px' }}>Common Questions</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {faqs.map((f, i) => (
                        <div
                            key={i}
                            className={`fb-faq-item ${openIndex === i ? 'open' : ''}`}
                            onClick={() => toggle(i)}
                            style={{
                                padding: '24px',
                                borderRadius: '16px',
                                background: '#f9f9f9',
                                border: '1px solid rgba(0,0,0,0.05)'
                            }}
                        >
                            <div className="fb-faq-question">
                                <h3 className="fb-h3" style={{ fontSize: '1.1rem', margin: 0 }}>{f.q}</h3>
                                <span className="fb-faq-icon">+</span>
                            </div>
                            <div className="fb-faq-answer">
                                <p style={{ color: 'rgba(26,26,26,0.65)', lineHeight: 1.5 }}>{f.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
