## Objetivo

Na página `/projects`, o botão "Excluir" hoje só remove o registro do Supabase. Passará a fazer a mesma limpeza completa que a página `/projects/:id` já faz: chamar o backend Python (limpeza de ChromaDB + arquivos no Storage) antes de excluir do banco.

## Mudanças

Arquivo: `src/pages/Projects.tsx`

1. No `handleDelete`, antes de `deleteProject.mutateAsync(id)`:
   - Validar sessão via `supabase.auth.getSession()`; se ausente, exibir toast de erro e abortar.
   - Importar `deleteProjectData` de `@/lib/python-backend` e chamá-lo com `project.id` e `project.storage_folder_path || project.id`.
2. Depois, executar o delete no Supabase (cascade) como já ocorre.
3. Marcar o projeto como "em exclusão" durante a operação:
   - Estado local `deletingIds` para desabilitar a ação e mostrar spinner na linha.
   - Registrar/limpar o id em `localStorage['deletingProjects']`, mesmo padrão do `ProjectDetail`, para manter consistência entre as páginas.
4. Tratamento de erro com toast em português e limpeza garantida no `finally`, seguido de invalidação de `['projects']`.
5. Fechar o diálogo imediatamente ao confirmar (a exclusão roda em background), evitando UI travada durante a chamada ao backend.

## Detalhes técnicos

- Reaproveita a função existente `deleteProjectData(projectId, folderPath)` de `src/lib/python-backend.ts`, que passa pelo `python-backend-proxy`.
- Nenhuma alteração em edge functions, banco ou backend Python.
- O campo `storage_folder_path` já vem no `select('*')` do hook `useProjects`, então não é necessário refetch adicional.
