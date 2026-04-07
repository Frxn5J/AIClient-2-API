/**
 * WebFetchTool - Fetch web content using native fetch (Node 20+)
 * 
 * Input schema:
 * {
 *   url: string,                    // URL to fetch
 *   format?: 'text'|'markdown'|'html' // Output format (default: 'text')
 * }
 * 
 * Output schema:
 * {
 *   content: string,
 *   format: string,
 *   url: string
 * }
 */

/**
 * Fetch content from a URL
 * @param {Object} toolInput - Input with url and format
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Result with content, format, url
 */
export async function execute(toolInput, config) {
    const { url, format = 'text' } = toolInput;
    
    if (!url || typeof url !== 'string') {
        throw new Error('WebFetchTool: url is required and must be a string');
    }
    
    // Validate URL format
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (error) {
        throw new Error(`WebFetchTool: Invalid URL: ${error.message}`);
    }
    
    // Only allow http and https protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('WebFetchTool: Only http and https protocols are allowed');
    }
    
    // Validate format
    const validFormats = ['text', 'markdown', 'html'];
    if (!validFormats.includes(format)) {
        throw new Error(`WebFetchTool: Invalid format. Must be one of: ${validFormats.join(', ')}`);
    }
    
    // Set up timeout
    const timeout = config.TOOL_WEBFETCH_TIMEOUT_MS || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'AIClient-2-API/1.0 (Local Tool Runtime)',
                'Accept': format === 'html' ? 'text/html,application/xhtml+xml' : '*/*'
            },
            signal: controller.signal,
            redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`WebFetchTool: HTTP error ${response.status}: ${response.statusText}`);
        }
        
        let content;
        
        if (format === 'html' || format === 'markdown') {
            // Get raw content for HTML/Markdown
            content = await response.text();
        } else {
            // For 'text', try to get text, fall back to what we have
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('text/html')) {
                // If it's HTML and format is text, extract text content
                content = await response.text();
                content = stripHtmlTags(content);
            } else if (contentType.includes('application/json')) {
                // Format JSON as pretty-printed text
                const json = await response.json();
                content = JSON.stringify(json, null, 2);
            } else {
                // Default to text
                content = await response.text();
            }
        }
        
        // For markdown format, optionally convert HTML to markdown
        // (Simple implementation - could use a library for full conversion)
        
        return {
            content,
            format,
            url: response.url || url // Follow redirects
        };
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error(`WebFetchTool: Request timed out after ${timeout}ms`);
        }
        
        throw new Error(`WebFetchTool: Failed to fetch: ${error.message}`);
    }
}

/**
 * Strip HTML tags from content (simple implementation)
 * @param {string} html - HTML content
 * @returns {string} Text content
 */
function stripHtmlTags(html) {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Input schema for WebFetchTool (JSON Schema format)
 */
export const inputSchema = {
    type: 'object',
    properties: {
        url: {
            type: 'string',
            description: 'URL to fetch content from'
        },
        format: {
            type: 'string',
            enum: ['text', 'markdown', 'html'],
            description: 'Output format (default: text)',
            default: 'text'
        }
    },
    required: ['url']
};

export default {
    name: 'webfetch',
    description: 'Fetch content from a URL. Use for retrieving web pages or API responses.',
    inputSchema,
    execute
};