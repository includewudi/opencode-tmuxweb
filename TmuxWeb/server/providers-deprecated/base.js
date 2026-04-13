/**
 * CLI History Provider Interface
 *
 * Each provider must export an object with the following shape.
 * Since JS has no formal interfaces, follow this contract to ensure
 * compatibility with the routes layer.
 *
 * {
 *   id: string,
 *     Unique identifier (e.g. 'opencode', 'cursor', 'aider').
 *
 *   name: string,
 *     Human-readable name (e.g. 'OpenCode', 'Cursor', 'Aider').
 *
 *   enabled: boolean,
 *     Whether this provider is operational (DB exists, deps available, etc.).
 *
 *   listSessions(opts) → { sessions: SessionSummary[], total: number },
 *     opts: { limit?: number, offset?: number, search?: string }
 *     List sessions with optional text search and pagination.
 *
 *   getSession(sessionId) → SessionDetail | null,
 *     Get a single session with all its messages and parts.
 *
 *   getToolCalls(sessionId, opts) → { toolCalls: ToolCallRecord[], total: number },
 *     opts: { limit?: number, offset?: number }
 *     Get tool call records (bash, read, edit, etc.) for a session.
 *
 *   search(query, opts) → SearchResult[],
 *     opts: { limit?: number }
 *     Cross-session text search across titles and message content.
 * }
 *
 * --- Type Definitions ---
 *
 * SessionSummary: {
 *   id: string,
 *   title: string,
 *   directory: string,
 *   projectName: string | null,
 *   agent: string | null,
 *   messageCount: number,
 *   timeCreated: number,   // seconds (unix epoch)
 *   timeUpdated: number,   // seconds (unix epoch)
 * }
 *
 * SessionDetail: SessionSummary & {
 *   messages: MessageRecord[],
 * }
 *
 * MessageRecord: {
 *   id: string,
 *   role: string,
 *   agent: string | null,
 *   modelID: string | null,
 *   providerID: string | null,
 *   tokens: { total, input, output, reasoning } | null,
 *   timeCreated: number,
 *   timeUpdated: number,
 *   parts: PartRecord[],
 * }
 *
 * PartRecord: {
 *   id: string,
 *   type: 'text' | 'tool',
 *   // For type='text':
 *   text: string | null,
 *   // For type='tool':
 *   tool: string | null,
 *   callID: string | null,
 *   status: string | null,
 *   input: any | null,
 *   output: string | null,
 *   duration: number | null,  // milliseconds
 * }
 *
 * ToolCallRecord: {
 *   id: string,
 *   tool: string,
 *   callID: string,
 *   status: string,
 *   input: any,
 *   output: string,
 *   duration: number,
 *   timeCreated: number,
 * }
 *
 * SearchResult: {
 *   sessionId: string,
 *   sessionTitle: string,
 *   matchType: 'title' | 'content',
 *   context: string,
 *   timeUpdated: number,
 * }
 */

module.exports = { /* interface documentation — see JSDoc above */ };
