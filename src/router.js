// Roteamento e renderização. Decide qual "view" desenhar e dispara os
// ganchos pós-render (QR Code do PIX, drag-and-drop do admin).
import { viewHome, footerHTML } from "./views/home.js";
import {
  viewService, viewBarber, viewDateTime, viewClient, viewSummary, viewPayment, viewDone, renderPix
} from "./views/booking.js";
import { viewAdmin, bindAdmin } from "./views/admin.js";

let route = "home";
export function currentRoute(){ return route; }

const VIEW   = () => document.getElementById("view");
const FOOTER = () => document.getElementById("footer");

export function go(r){
  route = r;
  document.getElementById("topbar").classList.toggle("hidden", r==="home");
  window.scrollTo(0,0);
  render();
}

export function render(){
  let html = "";
  switch(route){
    case "home":     html = viewHome(); break;
    case "service":  html = viewService(); break;
    case "barber":   html = viewBarber(); break;
    case "datetime": html = viewDateTime(); break;
    case "client":   html = viewClient(); break;
    case "summary":  html = viewSummary(); break;
    case "payment":  html = viewPayment(); break;
    case "done":     html = viewDone(); break;
    case "admin":    html = viewAdmin(); break;
    default:         html = viewHome();
  }
  VIEW().innerHTML = html;
  FOOTER().innerHTML = (route==="admin") ? "" : footerHTML();

  if(route==="payment") setTimeout(renderPix, 30);
  if(route==="admin")   setTimeout(bindAdmin, 10);
}
