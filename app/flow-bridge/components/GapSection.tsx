export default function GapSection() {
    return (
        <section className="fb-section fb-gap-section">
            <div className="fb-container">
                <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                    <span className="fb-section-label">The Gap</span>
                    <h2 className="fb-h2">AI generates. Editing sucks.</h2>

                    <div className="fb-grid-2" style={{ gap: '60px', marginTop: '60px', textAlign: 'left' }}>
                        <div className="problem-card">
                            <h3 className="fb-h3" style={{ opacity: 0.5 }}>The Old Way</h3>
                            <p className="fb-lead" style={{ fontSize: '1.1rem' }}>
                                Stay in AI editors and fight messy code when you want real design control.
                            </p>
                        </div>
                        <div className="problem-card">
                            <h3 className="fb-h3" style={{ opacity: 0.5 }}>The Other Way</h3>
                            <p className="fb-lead" style={{ fontSize: '1.1rem' }}>
                                Stay in Webflow and miss out on AI speed.
                            </p>
                        </div>
                    </div>

                    <div style={{ marginTop: '60px' }}>
                        <p className="fb-h3" style={{ color: '#ff531f' }}>Flow Bridge is the missing link.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
