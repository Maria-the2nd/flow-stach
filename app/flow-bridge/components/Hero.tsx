export default function Hero() {
    return (
        <section className="fb-hero">
            <div className="fb-container">
                <div className="fb-grid-2">
                    <div className="fb-hero-content">
                        <span className="fb-section-label" style={{ color: '#ff531f' }}>Flow Bridge</span>
                        <h1 className="fb-h1 fb-display">
                            Turn AI websites into Webflow components.
                            <span style={{ color: '#ff531f', display: 'block' }}>Instantly.</span>
                        </h1>
                        <p className="fb-lead">
                            AI can generate HTML/CSS/JS fast. Editing it is misery. Flow Bridge turns that output into clean, reusable components you can paste into Webflow and polish like a pro.
                        </p>
                        <div className="fb-hero-actions">
                            <a href="#import" className="fb-btn fb-btn-primary">Try the Import</a>
                            <button className="fb-btn fb-btn-secondary inverted">Watch a 60s demo</button>
                        </div>
                        <p className="fb-hero-trust">
                            Works with Cursor, v0, Bolt, and “whatever your AI tool vomited out today”.
                        </p>
                    </div>
                    <div className="fb-hero-visual">
                        {/* Placeholder for visual/demo content */}
                        <div style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '24px',
                            padding: '24px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            aspectRatio: '4/3'
                        }}>
                            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: '40%' }}>
                                [ Hero Visual / Canvas preview ]
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
