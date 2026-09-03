"use client";

import { useMemo, useState } from "react";

type Tab = "Visão geral" | "Eventos" | "Contatos" | "Campanhas" | "Reservas" | "Inbox" | "Agente IA";

const tabs: Tab[] = ["Visão geral", "Eventos", "Contatos", "Campanhas", "Reservas", "Inbox", "Agente IA"];

const contacts = [
  { name: "Ana Martins", channel: "WhatsApp", status: "Interessada", last: "há 4 min" },
  { name: "Lucas Ribeiro", channel: "Instagram", status: "Quer reservar", last: "há 9 min" },
  { name: "Mariana Costa", channel: "WhatsApp", status: "Confirmada", last: "há 14 min" },
  { name: "Rafael Souza", channel: "Instagram", status: "Dúvida", last: "há 22 min" },
  { name: "Bruna Lima", channel: "WhatsApp", status: "Aguardando", last: "há 31 min" },
];

const reservations = [
  { name: "Mariana Costa", people: 6, table: "M12", value: 360, status: "Confirmada" },
  { name: "Felipe Andrade", people: 4, table: "M08", value: 240, status: "Sinal pendente" },
  { name: "Lucas Ribeiro", people: 8, table: "M17", value: 480, status: "Em negociação" },
  { name: "Carla Mendes", people: 4, table: "M04", value: 240, status: "Confirmada" },
];

export default function Home() {
  const [active, setActive] = useState<Tab>("Visão geral");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [automation, setAutomation] = useState(true);

  const capacity = 420;
  const confirmed = 286;
  const reserved = 71;
  const occupancy = Math.round(((confirmed + reserved) / capacity) * 100);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const pageTitle = useMemo(() => {
    if (active === "Visão geral") return "Operação do evento";
    return active;
  }, [active]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">RJ</div>
          <div>
            <strong>ERREJOTA</strong>
            <span>Eventos & Reservas</span>
          </div>
        </div>

        <nav className="nav">
          {tabs.map((tab) => (
            <button key={tab} className={active === tab ? "navItem active" : "navItem"} onClick={() => setActive(tab)}>
              <span className="navDot" />
              {tab}
            </button>
          ))}
        </nav>

        <div className="sidebarCard">
          <span className="eyebrow">AUTOMAÇÃO</span>
          <div className="automationRow">
            <div>
              <strong>{automation ? "Operação ativa" : "Operação pausada"}</strong>
              <small>Follow-up e triagem</small>
            </div>
            <button className={automation ? "switch on" : "switch"} onClick={() => setAutomation(!automation)} aria-label="Alternar automação">
              <span />
            </button>
          </div>
        </div>

        <div className="profile">
          <div className="avatar">AD</div>
          <div><strong>Administrador</strong><span>Produtor do evento</span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">SEXTA • 11 SET • ERREJOTA BAR</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topActions">
            <button className="button ghost" onClick={() => notify("Relatório atualizado com os dados mais recentes.")}>Atualizar dados</button>
            <button className="button primary" onClick={() => setCampaignOpen(true)}>+ Nova campanha</button>
          </div>
        </header>

        {active === "Visão geral" && (
          <>
            <section className="heroPanel">
              <div>
                <span className="statusLive">● EVENTO EM CAMPANHA</span>
                <h2>Sexta no Errejota • Open Format</h2>
                <p>Meta operacional: chegar à lotação máxima mantendo qualidade no atendimento e nas reservas.</p>
              </div>
              <div className="occupancyRing" style={{ ["--progress" as string]: `${occupancy * 3.6}deg` }}>
                <div><strong>{occupancy}%</strong><span>ocupação projetada</span></div>
              </div>
            </section>

            <section className="metrics">
              <Metric label="Capacidade" value="420" hint="pessoas" />
              <Metric label="Confirmados" value="286" hint="check-ins previstos" trend="+38 hoje" />
              <Metric label="Em reserva" value="71" hint="aguardando fechamento" trend="+19 hoje" />
              <Metric label="Lugares livres" value="63" hint="oportunidade restante" />
            </section>

            <section className="gridTwo">
              <div className="panel">
                <div className="panelHeader"><div><span className="eyebrow">FUNIL</span><h3>Da conversa à presença</h3></div><button className="textButton" onClick={() => setActive("Campanhas")}>Ver campanhas</button></div>
                <div className="funnel">
                  <FunnelRow label="Contatos elegíveis" value={1840} pct={100} />
                  <FunnelRow label="Mensagens entregues" value={1214} pct={66} />
                  <FunnelRow label="Respostas" value={426} pct={35} />
                  <FunnelRow label="Interesse identificado" value={238} pct={56} />
                  <FunnelRow label="Reservas / confirmações" value={142} pct={60} />
                </div>
              </div>

              <div className="panel">
                <div className="panelHeader"><div><span className="eyebrow">AGENTE IA</span><h3>Prioridades agora</h3></div><span className="badge success">Ativo</span></div>
                <div className="taskList">
                  <Task priority="Alta" title="12 pessoas pediram reserva" text="Responder e definir mesa antes de perder intenção." />
                  <Task priority="Alta" title="18 sinais ainda pendentes" text="Enviar lembrete somente para quem já iniciou a reserva." />
                  <Task priority="Média" title="43 interessados sem retorno" text="Priorizar quem respondeu nas últimas 6 horas." />
                  <Task priority="Baixa" title="Lista VIP quase completa" text="Restam 17 vagas no lote configurado." />
                </div>
              </div>
            </section>

            <section className="gridTwo bottomGrid">
              <div className="panel">
                <div className="panelHeader"><div><span className="eyebrow">CONVERSAS</span><h3>Últimas oportunidades</h3></div><button className="textButton" onClick={() => setActive("Inbox")}>Abrir inbox</button></div>
                <div className="tableLike">
                  {contacts.map((contact) => <ContactRow key={contact.name} {...contact} />)}
                </div>
              </div>
              <div className="panel">
                <div className="panelHeader"><div><span className="eyebrow">RESERVAS</span><h3>Mesas em movimento</h3></div><button className="textButton" onClick={() => setActive("Reservas")}>Ver reservas</button></div>
                <div className="reservationSummary"><strong>R$ 4.620</strong><span>receita potencial em reservas abertas</span></div>
                <div className="miniBars"><div style={{width:"74%"}}/><div style={{width:"58%"}}/><div style={{width:"42%"}}/><div style={{width:"31%"}}/></div>
                <div className="legend"><span>Confirmadas 48</span><span>Em negociação 31</span><span>Pendentes 18</span></div>
              </div>
            </section>
          </>
        )}

        {active === "Eventos" && <EventsView notify={notify} />}
        {active === "Contatos" && <ContactsView notify={notify} />}
        {active === "Campanhas" && <CampaignsView openCampaign={() => setCampaignOpen(true)} />}
        {active === "Reservas" && <ReservationsView notify={notify} />}
        {active === "Inbox" && <InboxView notify={notify} />}
        {active === "Agente IA" && <AgentView automation={automation} setAutomation={setAutomation} notify={notify} />}
      </section>

      {campaignOpen && <CampaignModal close={() => setCampaignOpen(false)} notify={(m) => { setCampaignOpen(false); notify(m); }} />}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Metric({ label, value, hint, trend }: {label:string;value:string;hint:string;trend?:string}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{hint}</small>{trend && <em>{trend}</em>}</div>;
}

function FunnelRow({label,value,pct}:{label:string;value:number;pct:number}) {
  return <div className="funnelRow"><div><span>{label}</span><strong>{value.toLocaleString("pt-BR")}</strong></div><div className="track"><i style={{width:`${pct}%`}} /></div><small>{pct}%</small></div>;
}

function Task({priority,title,text}:{priority:string;title:string;text:string}) {
  return <div className="task"><span className={`priority ${priority.toLowerCase().replace("é","e")}`}>{priority}</span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function ContactRow({name,channel,status,last}:{name:string;channel:string;status:string;last:string}) {
  return <div className="contactRow"><div className="initials">{name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div><div className="contactMain"><strong>{name}</strong><span>{channel} • {last}</span></div><span className="badge">{status}</span></div>;
}

function EventsView({notify}:{notify:(m:string)=>void}) {
  return <section className="contentStack"><div className="sectionIntro"><div><h2>Agenda de eventos</h2><p>Planejamento de capacidade, campanha e operação por evento.</p></div><button className="button primary" onClick={()=>notify("Fluxo de novo evento preparado para integração com banco de dados.")}>+ Criar evento</button></div><div className="eventCards"><EventCard date="11 SET" title="Sexta no Errejota • Open Format" capacity="420" booked="357" status="Campanha ativa"/><EventCard date="18 SET" title="Especial 2000 • DJ + Convidado" capacity="420" booked="184" status="Pré-venda"/><EventCard date="25 SET" title="Noite Sertaneja" capacity="420" booked="73" status="Planejamento"/></div></section>;
}

function EventCard({date,title,capacity,booked,status}:{date:string;title:string;capacity:string;booked:string;status:string}) {
  return <article className="eventCard"><div className="dateBox">{date}</div><div><span className="badge success">{status}</span><h3>{title}</h3><p>{booked} pessoas entre confirmados e reservas • capacidade {capacity}</p></div><button className="button ghost">Abrir operação</button></article>;
}

function ContactsView({notify}:{notify:(m:string)=>void}) {
  return <section className="contentStack"><div className="sectionIntro"><div><h2>CRM de contatos</h2><p>Contatos organizados por origem, interesse, consentimento e histórico.</p></div><button className="button primary" onClick={()=>notify("Importação deve registrar origem e consentimento antes de liberar campanhas.")}>Importar contatos</button></div><div className="filters"><button className="chip active">Todos 1.840</button><button className="chip">WhatsApp 1.122</button><button className="chip">Instagram 718</button><button className="chip">VIP 246</button><button className="chip">Já reservaram 398</button><button className="chip">Opt-out 27</button></div><div className="panel"><div className="tableLike">{[...contacts,...contacts].map((c,i)=><ContactRow key={`${c.name}-${i}`} {...c} />)}</div></div></section>;
}

function CampaignsView({openCampaign}:{openCampaign:()=>void}) {
  return <section className="contentStack"><div className="sectionIntro"><div><h2>Campanhas</h2><p>Planeje comunicação por público, canal e etapa do evento.</p></div><button className="button primary" onClick={openCampaign}>+ Nova campanha</button></div><div className="campaignGrid"><CampaignCard title="Reserva de mesa • Base quente" channel="WhatsApp" sent="612" replies="188" conversion="21,4%" status="Em andamento"/><CampaignCard title="Quem respondeu ao story" channel="Instagram" sent="248" replies="94" conversion="18,1%" status="Em andamento"/><CampaignCard title="Confirmação de presença" channel="WhatsApp" sent="286" replies="203" conversion="71,0%" status="Concluída"/></div><div className="complianceNote"><strong>Proteção de conta e reputação</strong><p>Campanhas só devem usar contatos elegíveis, consentimento registrado, supressão de opt-out e limites de frequência. Para WhatsApp iniciado pela empresa, use template aprovado. Para Instagram, respeite as conversas e permissões disponibilizadas pela API oficial.</p></div></section>;
}

function CampaignCard({title,channel,sent,replies,conversion,status}:{title:string;channel:string;sent:string;replies:string;conversion:string;status:string}) {
  return <article className="campaignCard"><div className="panelHeader"><span className="badge success">{status}</span><span className="channelTag">{channel}</span></div><h3>{title}</h3><div className="campaignStats"><div><span>Enviadas</span><strong>{sent}</strong></div><div><span>Respostas</span><strong>{replies}</strong></div><div><span>Conversão</span><strong>{conversion}</strong></div></div><button className="button ghost full">Abrir relatório</button></article>;
}

function ReservationsView({notify}:{notify:(m:string)=>void}) {
  return <section className="contentStack"><div className="sectionIntro"><div><h2>Reservas de mesa</h2><p>Do interesse inicial até sinal, confirmação e check-in.</p></div><button className="button primary" onClick={()=>notify("Nova reserva iniciada. Próximo passo: persistir no banco multiempresa.")}>+ Nova reserva</button></div><div className="metrics compact"><Metric label="Confirmadas" value="48" hint="mesas"/><Metric label="Negociação" value="31" hint="mesas"/><Metric label="Sinal pendente" value="18" hint="mesas"/><Metric label="Receita potencial" value="R$ 4,6 mil" hint="reservas abertas"/></div><div className="panel reservationTable">{reservations.map(r=><div className="reservationRow" key={r.name}><div><strong>{r.name}</strong><span>{r.people} pessoas • mesa {r.table}</span></div><strong>R$ {r.value.toLocaleString("pt-BR")}</strong><span className="badge">{r.status}</span><button className="textButton" onClick={()=>notify(`Reserva de ${r.name} aberta para atendimento.`)}>Atender</button></div>)}</div></section>;
}

function InboxView({notify}:{notify:(m:string)=>void}) {
  const [selected,setSelected] = useState(1);
  return <section className="inboxLayout"><div className="conversationList"><div className="searchBox">Buscar conversa...</div>{contacts.map((c,i)=><button className={selected===i?"conversation active":"conversation"} key={c.name} onClick={()=>setSelected(i)}><div className="initials">{c.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div><div><strong>{c.name}</strong><span>{c.status} • {c.last}</span></div></button>)}</div><div className="chatPanel"><div className="chatHeader"><div><strong>{contacts[selected].name}</strong><span>{contacts[selected].channel} • intenção: {contacts[selected].status}</span></div><button className="button ghost" onClick={()=>notify("Conversa marcada como prioridade para atendimento humano.")}>Priorizar</button></div><div className="messages"><div className="bubble incoming">Oi! Vi o evento e queria saber se ainda tem mesa para 6 pessoas.</div><div className="bubble outgoing">Temos disponibilidade em alguns setores. Posso te ajudar com a reserva. Você prefere uma mesa próxima ao palco ou uma área mais tranquila?</div><div className="bubble incoming">Mais perto do palco.</div><div className="aiSuggestion"><span>IA sugere</span><p>Perfeito. Vou verificar as opções mais próximas do palco para 6 pessoas e já te passo o próximo passo da reserva.</p><button onClick={()=>notify("Sugestão aprovada. Envio real depende da integração do canal.")}>Usar resposta</button></div></div><div className="composer"><input placeholder="Digite uma mensagem..."/><button className="button primary" onClick={()=>notify("Mensagem preparada. Conecte as credenciais oficiais para envio real.")}>Enviar</button></div></div></section>;
}

function AgentView({automation,setAutomation,notify}:{automation:boolean;setAutomation:(v:boolean)=>void;notify:(m:string)=>void}) {
  return <section className="contentStack"><div className="sectionIntro"><div><h2>Agente de IA comercial</h2><p>Triagem, qualificação, resumo e priorização das conversas do evento.</p></div><button className={automation?"button danger":"button primary"} onClick={()=>setAutomation(!automation)}>{automation?"Pausar agente":"Ativar agente"}</button></div><div className="gridTwo"><div className="panel"><span className="eyebrow">COMPORTAMENTO</span><h3>Regras do atendimento</h3><div className="ruleList"><Rule title="Objetivo" text="Levar o contato de interesse para reserva, confirmação ou lista VIP."/><Rule title="Tom" text="Humano, curto, objetivo e sem respostas em bloco."/><Rule title="Escalonamento" text="Transferir para humano em negociação especial, reclamação ou solicitação explícita."/><Rule title="Proteção" text="Nunca insistir após opt-out e nunca enviar campanha a contato sem elegibilidade."/></div></div><div className="panel"><span className="eyebrow">AUTOMAÇÕES</span><h3>Rotinas configuradas</h3><div className="toggleList"><Toggle label="Classificar intenção" enabled/><Toggle label="Sugerir resposta" enabled/><Toggle label="Criar tarefa de follow-up" enabled/><Toggle label="Responder automaticamente" enabled={false}/><Toggle label="Resumo da conversa" enabled/></div><button className="button ghost full" onClick={()=>notify("Configurações do agente registradas na interface do MVP.")}>Salvar regras</button></div></div></section>;
}

function Rule({title,text}:{title:string;text:string}) { return <div className="rule"><strong>{title}</strong><p>{text}</p></div>; }
function Toggle({label,enabled}:{label:string;enabled:boolean}) { return <div className="toggleItem"><span>{label}</span><span className={enabled?"miniSwitch on":"miniSwitch"}><i/></span></div>; }

function CampaignModal({close,notify}:{close:()=>void;notify:(m:string)=>void}) {
  const [channel,setChannel] = useState("WhatsApp");
  return <div className="modalBackdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modalHeader"><div><span className="eyebrow">NOVA CAMPANHA</span><h2>Acionar público do evento</h2></div><button className="close" onClick={close}>×</button></div><label>Nome da campanha<input defaultValue="Últimas mesas • Sexta Errejota"/></label><label>Canal<div className="segmented"><button className={channel==="WhatsApp"?"selected":""} onClick={()=>setChannel("WhatsApp")}>WhatsApp</button><button className={channel==="Instagram"?"selected":""} onClick={()=>setChannel("Instagram")}>Instagram</button></div></label><label>Segmento<select defaultValue="quente"><option value="quente">Interessados e clientes recentes</option><option value="vip">Lista VIP com consentimento</option><option value="reserva">Reserva iniciada sem conclusão</option></select></label><label>Mensagem<textarea defaultValue="Oi! Sexta tem evento no Errejota e ainda temos algumas opções de mesa. Quer que eu te mostre as disponibilidades?"/></label><div className="warning"><strong>Antes do envio</strong><span>O motor valida consentimento, opt-out e limite de frequência. No WhatsApp, campanhas iniciadas pela empresa devem usar template aprovado.</span></div><div className="modalActions"><button className="button ghost" onClick={close}>Cancelar</button><button className="button primary" onClick={()=>notify(`Campanha de ${channel} criada em modo seguro. Configure as credenciais oficiais para disparo real.`)}>Criar campanha</button></div></div></div>;
}
