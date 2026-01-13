"use client";

import Link from "next/link";
import { useState } from "react";

export default function Nav() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <nav className="fb-nav">
            <div className="fb-container fb-nav-content">
                <div className="fb-nav-left">
                    <Link href="/flow-bridge" className="fb-nav-logo">
                        Flow Bridge
                    </Link>
                </div>

                <div className="fb-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div className="fb-nav-links hidden-mobile">
                        <a href="#how-it-works" className="fb-nav-link">How it works</a>
                        <a href="#features" className="fb-nav-link">Features</a>
                        <a href="#pricing" className="fb-nav-link">Pricing</a>
                        <a href="#academy" className="fb-nav-link">Academy</a>
                        <a href="/assets" className="fb-nav-link">Login</a>
                    </div>
                    <a href="/assets" className="fb-btn fb-btn-primary" style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                        Try the Import
                    </a>

                    <button
                        className={`fb-mobile-menu-toggle ${isOpen ? 'open' : ''}`}
                        onClick={toggleMenu}
                        aria-label="Toggle menu"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </div>

            <div className={`fb-mobile-menu-overlay ${isOpen ? 'open' : ''}`}>
                <div className="fb-mobile-menu-links">
                    <a href="#how-it-works" className="fb-mobile-menu-link" onClick={toggleMenu}>How it works</a>
                    <a href="#features" className="fb-mobile-menu-link" onClick={toggleMenu}>Features</a>
                    <a href="#pricing" className="fb-mobile-menu-link" onClick={toggleMenu}>Pricing</a>
                    <a href="#academy" className="fb-mobile-menu-link" onClick={toggleMenu}>Academy</a>
                    <a href="/assets" className="fb-mobile-menu-link" onClick={toggleMenu}>Login</a>
                </div>
            </div>
        </nav>
    );
}
