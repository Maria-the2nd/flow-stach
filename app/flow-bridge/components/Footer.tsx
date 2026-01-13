export default function Footer() {
    return (
        <footer className="fb-section" style={{ backgroundColor: '#2d2f2e', color: 'rgba(255,255,255,0.6)', padding: '60px 0' }}>
            <div className="fb-container">
                <div className="fb-nav-content">
                    <div style={{ fontSize: '0.9rem' }}>
                        &copy; {new Date().getFullYear()} Flow Bridge. Flow Party Presents.
                    </div>
                    <div className="fb-nav-links">
                        <a href="#" className="fb-nav-link">Docs</a>
                        <a href="#" className="fb-nav-link">Changelog</a>
                        <a href="#" className="fb-nav-link">Support</a>
                        <a href="#" className="fb-nav-link">Terms</a>
                        <a href="#" className="fb-nav-link">Privacy</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
