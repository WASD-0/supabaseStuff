// initialising Supabase Client

const { createClient } = supabase;

const supaUrl = "https://opjahunradznffmzljps.supabase.co"
const supaAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wamFodW5yYWR6bmZmbXpsanBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTgyNzc0OTUsImV4cCI6MjAxMzg1MzQ5NX0.xgNBR3-bJE9qpalrfVywGx93CUgBixcv0mnhqrioqMk"

const supaClient = createClient(supaUrl, supaAnonKey);


// html elements

const loginButon = document.getElementById("signInBtn");
const logoutButton = document.getElementById("signOutBtn");
const whenSignedIn = document.getElementById("whenSignedIn");
const whenSignedOut = document.getElementById("whenSignedOut");
const userDetails = document.getElementById("userDetails");
const myThingsSection = document.getElementById("myThings");
const myThingsList = document.getElementById("myThingsList");
const allThingsSection = document.getElementById("allThings");
const allThingsList = document.getElementById("allThingsList");
const createThing = document.getElementById("createThing");
const askForEmail = document.getElementById("askForEmail");
const emailConfirmation = document.getElementById("emailConfirmation");
const adminSendEmails = document.getElementById("adminSendEmails");
const askForEmailForm = document.getElementById("askForEmailForm");
const emailInput = document.getElementById("emailInput");
const cancelEmailBtn = document.getElementById("cancelEmailBtn");
const adminEmailSender = document.getElementById("adminEmailSender");
const emailContents = document.getElementById("emailContents");
const subjectInput = document.getElementById("subjectInput");

// event Listeners

loginButon.addEventListener("click", () => {
    supaClient.auth.signInWithOAuth({
      provider: "google",
    });
  });

logoutButton.addEventListener("click", () => {
    supaClient.auth.signOut();
});

createThing.addEventListener("click",  async () => {
    const { data: { user }, } = await supaClient.auth.getUser();
    const thing = createRandomThing(user);
    await supaClient.from("things").insert([thing]);
});


// init

checkUserOnStartUp();
let myThingsSubscription;
const allThings = {};
const myThings = {};
getAllInitialThings().then(() => listenToAllThings());

supaClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      adjustForUser(session.user);
    } else {
      adjustForNoUser();
    }
  });

// function declerations

async function checkUserOnStartUp() {
    const {
        data: { user },
    } = await supaClient.auth.getUser();
    if (user){
        adjustForUser(user);
    } else {
        adjustForNoUser
    }
}

async function adjustForUser(user) {
    whenSignedIn.hidden = false;
    whenSignedOut.hidden = true;
    myThingsSection.hidden = false;
    userDetails.innerHTML = `
  <h3>Hi ${user.user_metadata.full_name}</h3>
  <img src="${user.user_metadata.avatar_url}" />
  <p>UID: ${user.id}</p>`;
  await getAllInitialThings(user);
  listenToMyThingsChanges(user);


}

function adjustForNoUser() {
    whenSignedIn.hidden = true;
    whenSignedOut.hidden = false;
    myThingsSection.hidden = true;
    if(myThingsSubscription) {
        myThingsSubscription.unsubsrcibe();
        myThingsSubscription = null;
    }
}

async function getAllInitialThings() {
    const { data } = await supaClient.from("things").select();
    for (const thing of data) {
        allThings[thing.id] = thing;
    }
    renderAllThings();
}

function renderAllThings() {
    const tableHeader = `
  <thead>
    <tr>
      <th>Name</th>
      <th>Weight</th>
    </tr>
  </thead>`;
    const tableBody = Object.values(allThings)
      .sort((a, b) => (a.weight > b.weight ? -1 : 1))
      .map((thing) => {
        return `
  <tr>
    <td>${thing.name}</td>
    <td>${thing.weight} lbs.</td>
  </tr>`;
      })
      .join("");
    const table = `
  <table class="table table-striped">
    ${tableHeader}
    <tbody>${tableBody}</tbody>
  </table>`;
    allThingsList.innerHTML = table;
}

function createRandomThing(user) {
    if(!user) {
        console.error("Must be signed in to create a thing");
        return;
    } return {
        name: faker.commerce.productName(3),
        weight: Math.round(math.random() * 100),
        owner: user.id,
    };
}

function handleAllThingsUpdate(update) {
    if (update.eventType === "DELETE") {
        delete allThings[update.old.id];
    } else {
        allThings[update.new.id] = update.new;
    }
    renderAllThings();

}

function listenToAllThings() {
    supaClient
        .channel(`public:things`)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "things" },
            handleAllThingsUpdate
        )
        .subscribe();
}

async function getMyInitialThings(user){
    const { data } = await supaClient
        .from("things")
        .select("*")
        .eq("owner", user.id);
    for (const thing of data) {
        myThings[thing.id] = thing;
    }
    renderMyThings();
}

function hnadleMyThingsUpdate(update){
    if (update.eventType === "DELETE"){
        delete myThings[update.old.id];
    } else {
        myThings[update.new.id] = update.new;
    }
    renderMyThings();
}

async function listenToMyThingsChanges(user){
    if (myThingsSubscription){
        return;
    }
    supaClient
        .channel(`public:things`)
        .on(
            "postgres_changes",
            { event: "*", 
            schema: "public", 
            table: "things",
            filter: `owner=eq.${user.id}`,
        },
        hnadleMyThingsUpdate
        ). subscribe();
}
function renderMyThings(){
    const tableHeader = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Weight</th>
      </tr>
    </thead>`;
      const tableContents = Object.values(myThings)
        .sort((a, b) => (a.weight > b.weight ? -1 : 1))
        .map((thing) => {
          return `
    <tr>
      <td>${thing.name}</td>
      <td>${thing.weight} lbs.</td>
      <td>${deleteButtonTemplate(thing)}</td>
    </tr>`;
        })
        .join("");
      const table = `
    <table class="table table-striped">
      ${tableHeader}
      <tbody>${tableContents}</tbody>
    </table>`;
      myThingsList.innerHTML = table;
  }
function deleteButtonTemplate(){
    return`
    <button onclick="deleteAtID(${thing.id})" class="btn btn-outline-danger">
    ${trashIcon}
    </button>`;
}
async function deleteAtId(id){
    await supaClient.from("things").delete().eq("id", id);

}

const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
</svg>`;


