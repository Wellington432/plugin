# Agendamento de Carros (carbooking)

Plugin para **GLPI 11.0.x** que permite agendar carros da frota da SEDUC.

- O **usuário comum** solicita um carro informando data/hora de **saída** (a **chegada é opcional**), vê em uma agenda **quais carros estão em uso em cada dia** e é avisado se escolher um carro já agendado naquele dia.
- O **administrador** cadastra os carros (modelo, placa, ano e foto) e é o único que **aprova ou recusa** os agendamentos, com visão de quem está usando cada carro no dia.

## Requisitos

- GLPI **11.0.0** a **11.0.99**
- PHP compatível com o seu GLPI 11

## Instalação

1. Copie a pasta `carbooking/` para o diretório de plugins do GLPI:
   ```
   glpi/plugins/carbooking
   ```
   (ou `glpi/marketplace/carbooking` se preferir).
2. No GLPI, vá em **Configurar > Plugins**.
3. Clique em **Instalar** e depois em **Ativar** no "Agendamento de Carros".

Na instalação são criadas as tabelas `glpi_plugin_carbooking_cars` e
`glpi_plugin_carbooking_bookings`, e todos os direitos (incluindo o de
aprovação) são concedidos ao **perfil que está instalando** (normalmente
o super-admin).

## Liberando o acesso para os usuários

Por padrão só o perfil que instalou recebe direitos. Para os demais:

1. Vá em **Administração > Perfis**.
2. Selecione o perfil (ex.: "Self-Service" ou o perfil dos servidores).
3. Abra a aba **Agendamento de Carros**.
4. Marque:
   - **Agendamentos**: `Ler` + `Criar` para quem vai solicitar carros.
   - **Agendamentos > Aprovar agendamentos**: somente para quem aprova.
   - **Carros**: marque apenas para os administradores que cadastram a frota.
5. Salve.

> Quem **não** tiver o direito de aprovar enxerga apenas os próprios
> agendamentos na listagem, mas vê a ocupação de todos os carros na agenda.

## Uso

Menu **Ferramentas > Agendamento de Carros**:

- **Agendar**: agenda visual do dia. Navegue entre os dias, veja os carros
  livres / pendentes / em uso e envie a solicitação.
- **Agendamentos**: lista/busca dos pedidos. O administrador abre um pedido
  e usa o painel **Aprovação do agendamento** para aprovar ou recusar.
- **Carros** (admin): cadastro da frota com foto.

As fotos ficam fora da raiz web (`GLPI_PLUGIN_DOC_DIR/carbooking`) e são
servidas por `front/car.picture.php`, que checa a permissão de leitura.

## Estrutura

```
carbooking/
├── setup.php                     # init, hooks, versão
├── hook.php                      # install / uninstall (tabelas, direitos)
├── carbooking.xml                # metadados do catálogo
├── src/
│   ├── Car.php                   # itemtype da frota (+ foto)
│   ├── Booking.php               # itemtype do agendamento (status, aprovação, conflito)
│   └── Profile.php               # matriz de permissões
├── front/
│   ├── car.php / car.form.php    # CRUD da frota
│   ├── car.picture.php           # serve a foto com checagem de permissão
│   ├── booking.php / booking.form.php  # CRUD + aprovar/recusar
│   └── agenda.php                # página visual de agendamento
├── ajax/
│   └── carsstatus.php            # JSON: situação dos carros no dia
├── templates/                    # Twig (@carbooking/...)
├── public/                       # assets web — OBRIGATÓRIO ficar aqui no GLPI 11
│   ├── css/carbooking.css        # estilos + animações
│   └── js/agenda.js              # board do dia, navegação e aviso de conflito
└── locales/carbooking.pot
```

## Notas técnicas (GLPI 11)

- Classes em `src/` no namespace `GlpiPlugin\Carbooking` (autoload do GLPI).
- **Assets (CSS/JS) ficam em `public/`** — exigência do GLPI 11. A URL não leva
  `public/` (ex.: `public/css/carbooking.css` é servido em `/plugins/carbooking/css/carbooking.css`).
- Telas em **Twig** (`@carbooking/...`).
- Consultas em runtime usam o **query builder** (`$DB->request(...)`), sem SQL cru.
- Permissões verificadas em **todos** os arquivos `front/` e `ajax/`.
- O aviso de conflito de carro no mesmo dia é **não bloqueante** — registra o
  pedido e deixa a decisão para o administrador.

## Licença

MIT.
