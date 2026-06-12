# Guia de Implementação - Plugin Carbooking no GLPI 11

## 1. Instalação & Configuração

### Pré-requisitos
- GLPI 11.0.0 ou superior
- PHP 8.0+
- MariaDB 10.5+ ou MySQL 8.0+
- Acesso de Super-Admin ao GLPI

### Passos de Instalação

1. **Download do plugin**
   ```bash
   cd plugins/
   git clone <repo-url> carbooking
   cd carbooking
   ```

2. **Ativar no GLPI**
   - Ir a: Administração > Plugins
   - Procurar por "Carbooking"
   - Clicar "Instalar"
   - Clicar "Ativar"

3. **Verificar instalação**
   - Tabelas criadas em MySQL:
     - `glpi_plugin_carbooking_cars` (frota de carros)
     - `glpi_plugin_carbooking_bookings` (agendamentos)
   - Direitos criados em `glpi_profilerights`:
     - `carbooking::car` (permissões sobre carros)
     - `carbooking::booking` (permissões sobre agendamentos)

---

## 2. Configuração de Permissões

### Atribuir Permissões a um Perfil

1. **Acessar matriz de permissões**
   - Administração > Perfis
   - Selecionar perfil desejado (ex: "Técnico")
   - Clicar aba "Agendamento de Carros"

2. **Definir direitos do Carbooking**
   
   **Para Carros (carbooking::car):**
   - [ ] Leitura (READ) - Visualizar lista de carros
   - [ ] Modificação (UPDATE) - Editar dados do carro
   - [ ] Criação (CREATE) - Adicionar novo carro
   - [ ] Exclusão (DELETE) - Deletar carro
   - [ ] Purga (PURGE) - Purgar carro completamente

   **Para Agendamentos (carbooking::booking):**
   - [ ] Leitura (READ) - Visualizar agendamentos
   - [ ] Modificação (UPDATE) - Editar dados do agendamento
   - [ ] Criação (CREATE) - Criar novo agendamento
   - [ ] Exclusão (DELETE) - Deletar agendamento
   - [ ] Purga (PURGE) - Purgar agendamento
   - [ ] **Aprovação (APPROVE)** - Aprovar agendamentos pendentes

3. **Salvar permissões**
   - Clicar botão "Salvar"
   - Aguardar 2-3 segundos (sincronização)
   - Confirmar sucesso no log (se disponível)

### Exemplos de Configuração

**Super-Admin:**
```
carbooking::car:      ☑ Leitura ☑ Mod. ☑ Criação ☑ Exclusão ☑ Purga
carbooking::booking:  ☑ Leitura ☑ Mod. ☑ Criação ☑ Exclusão ☑ Purga ☑ Aprovação
```

**Gestor de Frota:**
```
carbooking::car:      ☑ Leitura ☑ Mod. ☑ Criação ☑ Exclusão ☐ Purga
carbooking::booking:  ☑ Leitura ☑ Mod. ☐ Criação ☐ Exclusão ☐ Purga ☑ Aprovação
```

**Funcionário (Helpdesk):**
```
carbooking::car:      ☐ (nenhuma - acesso livre via Helpdesk)
carbooking::booking:  ☐ (nenhuma - acesso livre via Helpdesk)
```

---

## 3. Sincronização de Permissões (GLPI 11)

### Como Funciona

Quando um admin modifica as permissões de um perfil, o sistema:

1. **Salva as alterações** no banco de dados imediatamente
2. **Atualiza a sessão** do admin (se foi seu próprio perfil)
3. **Aplicada instantaneamente** - sem necessidade de logout

### Sincronização em Tempo Real

**Para o próprio perfil do admin:**
- Admin edita seu próprio perfil → Salva
- ✓ Permissões já estão ativas (sessão sincronizada)
- ✓ Pode acessar funções do Carbooking imediatamente

**Para outro usuário:**
- Admin edita perfil do Usuário X → Salva
- ✓ Banco de dados atualizado
- ⚠ Usuário X precisa:
  - [ ] Fazer logout e login novamente, OU
  - [ ] Aguardar sincronização automática do GLPI 11 (se habilitada)

### Verificação de Sincronização

**Arquivo de debug:**
```
/plugins/carbooking/front/debug_session.php
```

**Para verificar permissões atuais do usuário logado:**
1. Acessar `http://seu-glpi/plugins/carbooking/front/debug_session.php`
2. Será exibida lista de permissões do carbooking na sessão
3. Exemplo de saída:
   ```
   carbooking::booking = 7 (Leitura + Modificação + Criação)
   carbooking::car = 1 (Leitura apenas)
   ```

---

## 4. Interfaces (Helpdesk vs Central)

### Interface Central (Admin/Técnico)

- **Acesso:** Apenas com permissões explícitas
- **Exemplo:** Gerente de Frota com permissão `carbooking::booking READ`
- **Comportamento:**
  - ✓ Vê página de Agendamentos
  - ✗ Sem permissão READ → Acesso negado (403)
  - ✗ Sem permissão CREATE → Botão "Novo" desabilitado

### Interface Helpdesk (Auto-atendimento)

- **Acesso:** Livre para usuários logados (sem verificação de permissão)
- **Exemplo:** Funcionários que querem agendar carros
- **Comportamento:**
  - ✓ Usuário logado pode agendar carro
  - ✓ Pode ver seus próprios agendamentos
  - ✗ Sem permissão APPROVE → Não pode aprovar outros

---

## 5. Funcionalidades Principais

### Módulo de Carros

**Localização:** Frota > Carbooking > Carros

**Funcionalidades:**
- Cadastrar novos carros (marca, modelo, placa, foto)
- Editar informações do carro
- Ativar/Desativar carro para agendamento
- Adicionar foto/imagem do carro
- Visualizar histórico de agendamentos

**Permissões Necessárias:**
- `carbooking::car READ` - visualizar lista

### Módulo de Agendamentos

**Localização:** Frota > Carbooking > Agendamentos

**Funcionalidades:**
- Criar novo agendamento
- Definir datas de saída/retorno
- Especificar destino e motivo
- Atribuir a setor/grupo
- Aprovar/rejeitar agendamento (gestor)
- Visualizar histórico de agendamentos
- Exportar agenda em PDF

**Permissões Necessárias:**
- `carbooking::booking READ` - visualizar
- `carbooking::booking CREATE` - criar agendamento
- `carbooking::booking APPROVE` - aprovar agendamento

### Módulo de Calendário

**Localização:** Frota > Carbooking > Calendário

**Funcionalidades:**
- Visualizar agenda mensal por carro
- Cor diferente para status (pendente, aprovado, rejeitado)
- Clicar no agendamento para ver detalhes
- Arrastar para redimensionar período

**Permissões Necessárias:**
- `carbooking::booking READ` - visualizar

### Módulo de Analytics

**Localização:** Frota > Carbooking > Analytics

**Funcionalidades:**
- Estatísticas de uso da frota
- Gráficos de utilização por carro
- Relatórios de agendamentos
- Taxa de aprovação

**Permissões Necessárias:**
- `carbooking::booking APPROVE` - acessar página

---

## 6. Fluxo Típico de Uso

### Funcionário (Helpdesk)
1. Login com seu usuário
2. Ir a: Suporte > Carbooking > Novo Agendamento
3. Preencher dados (carro, datas, motivo)
4. Clicar "Solicitar"
5. Agendamento fica com status "Pendente"
6. Aguarda aprovação do gestor

### Gestor de Frota (Central)
1. Login com Super-Admin ou Gestor
2. Ir a: Frota > Carbooking > Agendamentos
3. Ver lista de agendamentos pendentes
4. Selecionar agendamento
5. Visualizar detalhes (quem solicitou, quando, motivo)
6. Clicar "Aprovar" ou "Rejeitar"
7. Agendamento atualizado para "Aprovado" ou "Rejeitado"

---

## 7. Troubleshooting

### Problema: "Acesso negado" (403) na página de Agendamentos

**Causas possíveis:**
1. Usuário não tem permissão `carbooking::booking`
2. Perfil atribuído ao usuário não tem permissão ativada
3. Sessão não foi sincronizada após mudança de perfil

**Solução:**
1. Admin verifica permissões:
   - Administração > Usuários > [Usuário]
   - Tab "Perfis"
   - Confirmar que perfil tem `carbooking::booking`
2. Admin vai a Administração > Perfis > [Perfil]
   - Tab "Agendamento de Carros"
   - Confirmar que READ está marcado
3. Usuário faz logout/login para recarregar sessão

### Problema: Alteração de permissão não funciona imediatamente

**Causas:**
1. Admin editou perfil de outro usuário
2. Sessão em cache do navegador
3. GLPI 11 requer recarregar página

**Solução:**
1. Se editou seu próprio perfil: Recarregue página (F5)
2. Se editou perfil alheio: Usuário faz logout/login
3. Limpe cache do navegador: Ctrl+Shift+Delete
4. Acesse `front/debug_session.php` para verificar permissões

### Problema: Botão "Novo Agendamento" não aparece

**Causa:**
- Usuário não tem permissão `CREATE`

**Solução:**
1. Admin vai a: Administração > Perfis > [Perfil]
2. Tab "Agendamento de Carros"
3. Marca "Criação" para "Agendamentos"
4. Salva
5. Usuário recarrega página ou faz logout/login

### Problema: "Aprovar" indisponível para gestor

**Causa:**
- Perfil não tem permissão `APPROVE` em agendamentos

**Solução:**
1. Admin: Administração > Perfis > "Gestor de Frota"
2. Tab "Agendamento de Carros"
3. Marca checkbox "Aprovação" (APPROVE)
4. Salva
5. Gestor recarrega página

---

## 8. Log & Debugging

### Verificar Log de Sincronização

**Localização:**
```
GLPI_ROOT/files/log/carbooking-*.log
```

**Exemplo de conteúdo:**
```
[2024-01-15 14:30:45] GLPI 11: Perfil 1 sincronizado com sucesso.
[2024-01-15 14:31:20] GLPI 11: Perfil 5 sincronizado com sucesso.
```

**Como verificar:**
```bash
# SSH/Terminal
tail -f files/log/carbooking-*.log
```

### Debug de Sessão

**URL:**
```
http://seu-glpi.local/plugins/carbooking/front/debug_session.php
```

**Saída esperada:**
```
Permissões do Carbooking na Sessão Ativa:
carbooking::booking = 7
carbooking::car = 1
```

**Interpretação:**
- `carbooking::booking = 7` = Leitura + Modificação + Criação
- `carbooking::car = 1` = Leitura apenas
- Não aparecer = sem permissão

---

## 9. Boas Práticas

### ✓ Recomendações

- [ ] **Revisar permissões regularmente**
  - Quarterly audit de quem tem acesso

- [ ] **Usar perfis para diferentes funções**
  - Super-Admin: Todas as permissões
  - Gestor: APPROVE + READ + UPDATE
  - Técnico: READ + CREATE
  - Funcionário: Interface Helpdesk (livre)

- [ ] **Ativar logging**
  - Mantém `files/log/` com espaço disponível
  - Facilita auditoria

- [ ] **Testar mudanças de perfil**
  - Admin edita seu próprio perfil primeiro
  - Confirma sincronização
  - Depois altera para outros usuários

- [ ] **Usar debug_session.php para diagnóstico**
  - Se permissão não funciona
  - Acesse página de debug para verificar sessão

### ✗ Evitar

- [ ] **Não confiar apenas em matriz de permissions**
  - Sempre testar com usuário real
  - Permissões podem estar em cache

- [ ] **Não editar banco de dados manualmente**
  - Sempre use interface GLPI
  - Pode desincronizar sessões

- [ ] **Não deletar entradas de `glpi_profilerights`**
  - Sistema pode não recuperar bem
  - Reinstale plugin se necessário

---

## 10. Suporte & Documentação Adicional

### Documentação Técnica

- [GLPI11_SYNCHRONIZATION_FLOW.md](GLPI11_SYNCHRONIZATION_FLOW.md) - Fluxo técnico detalhado
- [GLPI11_COMPATIBILITY_TESTS.md](GLPI11_COMPATIBILITY_TESTS.md) - Testes de validação

### Código-Fonte

- `hook.php` - Sincronização de permissões
- `src/Profile.php` - Matriz de permissões
- `front/debug_session.php` - Ferramenta de debug
- `front/*.php` - Páginas com verificação de permissões

### Reportar Problema

Se encontrar issue:
1. Acesse [GitHub Issues](https://github.com/seu-repo/carbooking/issues)
2. Incluir:
   - Versão GLPI (ex: 11.0.5)
   - Versão do plugin
   - Passos para reproduzir
   - Log relevante (`carbooking-*.log`)

---

**Versão:** 1.0  
**Última atualização:** 2024  
**Compatibilidade:** GLPI 11.0+
