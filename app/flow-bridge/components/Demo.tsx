export default function Demo() {
    return (
        <section className="fb-section">
            <div className="fb-container">
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <span className="fb-section-label">Make it real</span>
                    <h2 className="fb-h2">Watch an AI site become editable components</h2>
                    <p className="fb-lead" style={{ margin: '0 auto' }}>
                        See how Flow Bridge breaks down a messy AI page into a tidy Webflow-ready component set.
                    </p>
                </div>

                <div style={{
                    width: '100%',
                    maxWidth: '1000px',
                    aspectRatio: '16/9',
                    background: '#2d2f2e',
                    borderRadius: '24px',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {/* Placeholder for Video/GIF */}
                    <div style={{ fontSize: '2rem', opacity: 0.5 }}>▶</div>
                    <div style={{ opacity: 0.5 }}>Demo Coming Soon</div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                    <button className="fb-btn fb-btn-primary" disabled>Coming Soon</button>
                </div>
            </div>
        </section>
    );
}
