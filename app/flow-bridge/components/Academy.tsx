export default function Academy() {
    return (
        <section id="academy" className="fb-section" style={{ backgroundColor: '#2d2f2e', color: 'white' }}>
            <div className="fb-container">
                <div className="fb-grid-2">
                    <div>
                        <span className="fb-section-label" style={{ color: '#ff531f' }}>The Academy</span>
                        <h2 className="fb-h2" style={{ color: 'white' }}>Learn the craft: AI → award-worthy</h2>
                        <p className="fb-lead" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '32px' }}>
                            Flow Bridge gives you speed. The Academy teaches you how to turn “AI slop” into work you’re proud to put your name on—Webflow polish, responsive finesse, micro-interactions, the good stuff.
                        </p>
                        <button className="fb-btn fb-btn-primary">Explore the Academy</button>
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.1)',
                        height: '300px',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.3)'
                    }}>
                        [ Academy Course Preview ]
                    </div>
                </div>
            </div>
        </section>
    );
}
