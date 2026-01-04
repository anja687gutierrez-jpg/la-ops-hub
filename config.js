/**
 * Ops Hub Portal Configuration
 *
 * This file loads environment variables for the browser app.
 * For local development, create a .env file with your API keys.
 *
 * Priority order:
 * 1. window.ENV (set by config.js)
 * 2. localStorage (user-configured via Settings)
 * 3. Empty/default values
 */

(function() {
    // Parse .env file format
    const parseEnv = (text) => {
        const env = {};
        text.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return env;
    };

    // Try to load .env file
    const loadEnv = async () => {
        try {
            const response = await fetch('.env');
            if (response.ok) {
                const text = await response.text();
                const env = parseEnv(text);

                // Store in window.ENV for app access
                window.ENV = env;

                // Also seed localStorage if not already set (first-time setup)
                if (env.GROQ_API_KEY && !localStorage.getItem('stap_groq_api_key')) {
                    localStorage.setItem('stap_groq_api_key', env.GROQ_API_KEY);
                    console.log('✅ Loaded GROQ_API_KEY from .env file');
                }

                return env;
            }
        } catch (e) {
            // .env file not found or not accessible - that's fine
            console.log('ℹ️ No .env file found - using localStorage for configuration');
        }
        return {};
    };

    // Initialize on page load
    window.ENV = {};
    loadEnv();
})();
