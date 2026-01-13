export default function Features() {
    return (
        <section id="features" className="fb-section" style={{ backgroundColor: '#FAFAFA' }}>
            <div className="fb-container">
                <span className="fb-section-label">Features</span>
                <h2 className="fb-h2" style={{ maxWidth: '600px' }}>Designer control, without losing AI speed</h2>

                <div className="fb-grid-3" style={{ marginTop: '60px' }}>
                    <div className="fb-feature-card">
                        <div className="fb-feature-icon">A</div>
                        <h3 className="fb-h3">Import any AI site</h3>
                        <p>Paste output from Cursor, v0, Bolt, or any generator.</p>
                    </div>
                    <div className="fb-feature-card">
                        <div className="fb-feature-icon">B</div>
                        <h3 className="fb-h3">Smart breakdown</h3>
                        <p>We split pages into clean blocks you’ll actually reuse.</p>
                    </div>
                    <div className="fb-feature-card">
                        <div className="fb-feature-icon">C</div>
                        <h3 className="fb-h3">One-click Export</h3>
                        <p>Clipboard-ready for the Designer. No weird rituals.</p>
                    </div>
                </div>

                <div style={{ marginTop: '60px', textAlign: 'center' }}>
                    <p className="fb-lead" style={{ margin: '0 auto' }}>
                        You get the 80% instantly—then win the last 20% with taste.
                    </p>
                </div>
            </div>
        </section>
    );
}
