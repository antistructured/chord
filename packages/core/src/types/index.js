/**
 * @typedef {Object} TaskPacket
 * @property {string} task_id
 * @property {string} task_kind
 * @property {string} source_type
 * @property {string} project
 * @property {string} phase
 * @property {string} target_entity
 * @property {string} role
 * @property {string} stance
 * @property {string[]} requested_action
 * @property {Object} inputs
 * @property {Object} constraints
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {string} task_id
 * @property {"completed"|"failed"|"blocked"} status
 * @property {"succeeded"|"failed"|"blocked"} outcome
 * @property {string} summary
 * @property {Object} outputs
 * @property {string=} artifact
 * @property {string=} domain
 */

/**
 * @typedef {Object} Registry
 * @property {Object.<string, any>} artifacts
 * @property {Object.<string, any>} domains
 * @property {Object.<string, any>} tasks
 * @property {Array<any>} task_queue
 * @property {Array<any>} event_journal
 * @property {Array<any>} execution_results
 * @property {Object.<string, boolean>} trigger_state
 * @property {Array<any>} specs
 */
export {};
