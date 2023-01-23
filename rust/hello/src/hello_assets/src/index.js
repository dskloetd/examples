import * as v from './vanilla.js';
import { hello } from "../../declarations/hello";

document.querySelector("#greet-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  document.getElementById("greeting").innerText = "";
  const loader = document.getElementById("loader");

  const button = e.target.querySelector("button");

  const name = document.getElementById("name").value.toString();

  loader.style.visibility = "visible";
  button.setAttribute("disabled", true);
  document.getElementById("name").setAttribute("disabled", true);

  // Interact with foo actor, calling the greet method
  const greeting = await hello.greet(name);

  loader.style.visibility = "hidden";
  button.removeAttribute("disabled");
  document.getElementById("name").removeAttribute("disabled");
  document.getElementById("greeting").innerText = greeting;

  return false;
});


document.querySelector("#set-greeting-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  document.getElementById("greeting").innerText = "";
  const loader = document.getElementById("loader");

  const button = e.target.querySelector("button");

  const greeting = document.getElementById("greeting-input").value.toString();
  console.log('greeting = ', greeting);

  loader.style.visibility = "visible";
  button.setAttribute("disabled", true);
  document.getElementById("name").setAttribute("disabled", true);

  // Interact with foo actor, calling the greet method
  const response = await hello.set_greeting(greeting);

  loader.style.visibility = "hidden";
  button.removeAttribute("disabled");
  document.getElementById("name").removeAttribute("disabled");
  document.getElementById("greeting").innerText = JSON.stringify(response);

  return false;
});




/// Survey app

const {button, div, form, h1, input, li, ul} = v.tags;
const {click, submit} = v.events;
const {type} = v.attributes;
const inputValue = v.eventProperty('input', 'value');

const surveyNames = new v.ObservableArray([]);
const surveyCount = new v.Observable(0);
const questions = new v.ObservableArray([]);

const surveyName = new v.Observable('');
const questionInputs = new v.ObservableArray([]);

function renderSurvey(surveyName) {
  return li(
    surveyName,
    button('get questions', click(fetchQuestions.bind(null, surveyName)))
  );
}

function renderQuestion(question) {
  return li(question);
}

function renderQuestionInput(ob) {
  return li(input(inputValue(ob)));
}

function addQuestionInput() {
  questionInputs.push(new v.Observable('?'));
}

async function fetchQuestions(survey) {
  const response = await hello.get_questions(survey);
  questions.splice(0, questions.length, ...response);
}

async function fetchSurveys() {
  const response = await hello.get_surveys();
  surveyNames.splice(0, surveyNames.length, ...response);
  surveyCount.set(response.length);
}

async function addNewSurvey(e) {
  e.preventDefault();
  await hello.add_survey({
    name: surveyName.value,
    questions: questionInputs.value.map(qi => qi.value),
  });
  questionInputs.splice(0, questionInputs.length);
  surveyName.set('');
  alert('added');
  fetchSurveys();
}

v.body(h1('Surveys'),
  div(button('List surveys', click(fetchSurveys))),
  div(surveyCount, ' surveys:'),
  div(ul(surveyNames.map(renderSurvey))),
  h1('Questions'),
  div(ul(questions.map(renderQuestion))),
  h1('Add survey'),
  form(
    submit(addNewSurvey),
    ul(
      li('Name', input(inputValue(surveyName))),
      questionInputs.map(renderQuestionInput),
      li(button(type('button'), 'Add question', click(addQuestionInput))),
      li(button(type('submit'), 'Add survey')),
    ),
  ),
);

fetchSurveys();
