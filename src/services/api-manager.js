import {
    handleModelListRequest,
    handleContentGenerationRequest,
    API_ACTIONS,
    ENDPOINT_TYPE
} from '../utils/common.js';
import { getProviderPoolManager } from './service-manager.js';
import { getApiService } from './service-manager.js';
import logger from '../utils/logger.js';
import { runAgentLoop } from '../tools/AgentLoop.js';

/**
 * Handle tool-enabled requests via AgentLoop
 * @param {http.IncomingMessage} req - The HTTP request object
 * @param {http.ServerResponse} res - The HTTP response object
 * @param {Object} currentConfig - The current configuration object
 * @param {string} promptLogFilename - The prompt log filename
 * @param {Object} providerPoolManager - The provider pool manager instance
 * @param {string} endpointType - The endpoint type (for API routing)
 * @param {string} path - The request path
 * @returns {Promise<boolean>} - True if request was handled
 */
async function handleToolRuntimeRequest(req, res, currentConfig, promptLogFilename, providerPoolManager, endpointType, path) {
    // Parse request body
    const body = await readRequestBody(req);
    let requestBody;
    try {
        requestBody = JSON.parse(body);
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid JSON in request body' } }));
        return true;
    }

    // Check if tools are present
    if (!requestBody.tools || !Array.isArray(requestBody.tools) || requestBody.tools.length === 0) {
        // No tools, fall back to normal handling
        return false;
    }

    logger.info(`[ToolRuntime] Processing request with ${requestBody.tools.length} tool(s)`);

    try {
        // Get API service for the current config
        const apiService = await getApiService(currentConfig);
        
        // Determine if streaming
        const isStreaming = requestBody.stream !== false;
        
        // Prepare request for AgentLoop
        const agentRequest = {
            model: requestBody.model,
            messages: requestBody.messages || [],
            tools: requestBody.tools,
            tool_choice: requestBody.tool_choice,
            temperature: requestBody.temperature,
            max_tokens: requestBody.max_tokens,
            stream: isStreaming
        };

        // For streaming, use the async generator
        if (isStreaming) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            });

            try {
                const stream = runAgentLoop(apiService.generateContentStream.bind(apiService), agentRequest, currentConfig);
                
                for await (const chunk of stream) {
                    const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
                    res.write(sseData);
                }
                
                res.write('data: [DONE]\n\n');
            } catch (error) {
                logger.error(`[ToolRuntime] Stream error: ${error.message}`);
                res.write(`data: ${JSON.stringify({ error: { message: error.message } })}\n\n`);
            }
            
            res.end();
            return true;
        } else {
            // Non-streaming: execute once and return final result
            const result = await runAgentLoop(apiService.generateContent.bind(apiService), agentRequest, currentConfig);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return true;
        }
    } catch (error) {
        logger.error(`[ToolRuntime] Error: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: error.message } }));
        return true;
    }
}
/**
 * Handle API authentication and routing
 * @param {string} method - The HTTP method
 * @param {string} path - The request path
 * @param {http.IncomingMessage} req - The HTTP request object
 * @param {http.ServerResponse} res - The HTTP response object
 * @param {Object} currentConfig - The current configuration object
 * @param {Object} apiService - The API service instance
 * @param {Object} providerPoolManager - The provider pool manager instance
 * @param {string} promptLogFilename - The prompt log filename
 * @returns {Promise<boolean>} - True if the request was handled by API
 */
export async function handleAPIRequests(method, path, req, res, currentConfig, apiService, providerPoolManager, promptLogFilename) {


    // Route model list requests
    if (method === 'GET') {
        if (path === '/v1/models') {
            await handleModelListRequest(req, res, apiService, ENDPOINT_TYPE.OPENAI_MODEL_LIST, currentConfig, providerPoolManager, currentConfig.uuid);
            return true;
        }
        if (path === '/v1beta/models') {
            await handleModelListRequest(req, res, apiService, ENDPOINT_TYPE.GEMINI_MODEL_LIST, currentConfig, providerPoolManager, currentConfig.uuid);
            return true;
        }
    }

    // Route content generation requests
    if (method === 'POST') {
        // Check if tool runtime is enabled and request has tools
        if (currentConfig.TOOL_RUNTIME_ENABLED === true) {
            // Try tool runtime first for chat/completions and messages endpoints
            if (path === '/v1/chat/completions' || path === '/v1/messages') {
                const toolHandled = await handleToolRuntimeRequest(req, res, currentConfig, promptLogFilename, providerPoolManager, 
                    path === '/v1/messages' ? ENDPOINT_TYPE.CLAUDE_MESSAGE : ENDPOINT_TYPE.OPENAI_CHAT, path);
                if (toolHandled) return true;
                // Fall through to normal handling if no tools present
            }
        }
        
        if (path === '/v1/chat/completions') {
            await handleContentGenerationRequest(req, res, apiService, ENDPOINT_TYPE.OPENAI_CHAT, currentConfig, promptLogFilename, providerPoolManager, currentConfig.uuid, path);
            return true;
        }
        if (path === '/v1/responses') {
            await handleContentGenerationRequest(req, res, apiService, ENDPOINT_TYPE.OPENAI_RESPONSES, currentConfig, promptLogFilename, providerPoolManager, currentConfig.uuid, path);
            return true;
        }
        const geminiUrlPattern = new RegExp(`/v1beta/models/(.+?):(${API_ACTIONS.GENERATE_CONTENT}|${API_ACTIONS.STREAM_GENERATE_CONTENT})`);
        if (geminiUrlPattern.test(path)) {
            await handleContentGenerationRequest(req, res, apiService, ENDPOINT_TYPE.GEMINI_CONTENT, currentConfig, promptLogFilename, providerPoolManager, currentConfig.uuid, path);
            return true;
        }
        if (path === '/v1/messages') {
            await handleContentGenerationRequest(req, res, apiService, ENDPOINT_TYPE.CLAUDE_MESSAGE, currentConfig, promptLogFilename, providerPoolManager, currentConfig.uuid, path);
            return true;
        }
    }

    return false;
}

/**
 * Initialize API management features
 * @param {Object} services - The initialized services
 * @returns {Function} - The heartbeat and token refresh function
 */
export function initializeAPIManagement(services) {
    const providerPoolManager = getProviderPoolManager();
    return async function heartbeatAndRefreshToken() {
        logger.info(`[Heartbeat] Server is running. Current time: ${new Date().toLocaleString()}`, Object.keys(services));
        // 循环遍历所有已初始化的服务适配器，并尝试刷新令牌
        // if (getProviderPoolManager()) {
        //     await getProviderPoolManager().performInitialHealthChecks(); // 定期执行健康检查
        // }
        for (const providerKey in services) {
            const serviceAdapter = services[providerKey];
            try {
                // For pooled providers, refreshToken should be handled by individual instances
                // For single instances, this remains relevant
                if (serviceAdapter.config?.uuid && providerPoolManager) {
                    providerPoolManager._enqueueRefresh(serviceAdapter.config.MODEL_PROVIDER, { 
                        config: serviceAdapter.config, 
                        uuid: serviceAdapter.config.uuid 
                    });
                } else {
                    await serviceAdapter.refreshToken();
                }
                // logger.info(`[Token Refresh] Refreshed token for ${providerKey}`);
            } catch (error) {
                logger.error(`[Token Refresh Error] Failed to refresh token for ${providerKey}: ${error.message}`);
                // 如果是号池中的某个实例刷新失败，这里需要捕获并更新其状态
                // 现有的 serviceInstances 存储的是每个配置对应的单例，而非池中的成员
                // 这意味着如果一个池成员的 token 刷新失败，需要找到它并更新其在 poolManager 中的状态
                // 暂时通过捕获错误日志来发现问题，更精细的控制需要在 refreshToken 中抛出更多信息
            }
        }
    };
}

/**
 * Helper function to read request body
 * @param {http.IncomingMessage} req The HTTP request object.
 * @returns {Promise<string>} The request body as string.
 */
export function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve(body);
        });
        req.on('error', err => {
            reject(err);
        });
    });
}