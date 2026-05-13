/**
 * Domain type definitions aligned with the Supabase schema.
 * These fields map directly to Supabase Postgres columns.
 *
 * @typedef {Object} Cliente
 * @property {string} id
 * @property {string} nome
 * @property {string} [email]
 * @property {string} [telefone]
 * @property {string} [empresa]
 * @property {'lead'|'qualificado'|'ativo'|'inativo'} status
 * @property {string} [squad_id]         - FK → squads.id
 * @property {string} [responsavel_id]   - FK → profiles.id
 * @property {string[]} [entregaveis]
 * @property {string} [notas]
 * @property {string} [created_at]
 * -- joined fields (returned by clientes.api.get / list) --
 * @property {UserProfile} [responsavel] - joined from profiles
 * @property {Squad} [squads]            - joined squad with nested squad_membros
 */

/**
 * @typedef {Object} Tarefa
 * @property {string} id
 * @property {string} titulo
 * @property {string} [descricao]
 * @property {'pendente'|'em_andamento'|'revisao'|'concluida'} status
 * @property {'baixa'|'media'|'alta'|'urgente'} prioridade
 * @property {string} [prazo]            - ISO date string YYYY-MM-DD
 * @property {string} [responsavel_id]   - FK → profiles.id
 * @property {string} [cliente_id]       - FK → clientes.id (optional)
 * @property {string} [projeto_id]       - FK → projetos.id (optional)
 * @property {string} [created_at]
 * -- joined fields --
 * @property {{ nome: string }} [clientes]   - joined cliente name
 * @property {UserProfile} [responsavel]     - joined from profiles
 */

/**
 * @typedef {Object} Projeto
 * @property {string} id
 * @property {string} nome
 * @property {string} [descricao]
 * @property {'ativo'|'pausado'|'concluido'} status
 * @property {string} [cliente_id]   - FK → clientes.id
 * @property {string} [prazo]
 * @property {{ nome: string }} [clientes] - joined cliente name (when selected)
 */

/**
 * @typedef {Object} Squad
 * @property {string} id
 * @property {string} nome
 * @property {string} [descricao]
 * @property {SquadMembro[]} [squad_membros] - joined memberships (when selected)
 */

/**
 * @typedef {Object} SquadMembro
 * @property {string} squad_id   - FK → squads.id  (part of composite PK)
 * @property {string} profile_id - FK → profiles.id (part of composite PK)
 * @property {string} [created_at]
 * @property {UserProfile} [profiles] - joined profile (when selected)
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} id
 * @property {string} [email]
 * @property {string} [full_name]
 * @property {'admin'|'social media'|'closer'|'sdr'} [role]
 */
