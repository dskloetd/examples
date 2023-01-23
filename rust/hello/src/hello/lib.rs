use candid::{CandidType, Deserialize};
use ic_cdk::trap;
use ic_cdk_macros::{update, query};
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(CandidType, Clone, Deserialize, Debug)]
struct Survey {
  name: String,
  questions: Vec<String>,
}

thread_local! {
  static SURVEYS: RefCell<HashMap<String, Vec<String>>> =
      RefCell::new(HashMap::new());
}

#[query]
fn get_surveys() -> Vec<String> {
  SURVEYS.with(|ref_cell| {
    let map = ref_cell.borrow();
    map.keys().map(String::clone).collect()
  })
}

#[query]
fn get_questions(survey: String) -> Vec<String> {
  SURVEYS.with(|ref_cell| {
    let map = ref_cell.borrow();
    match map.get(&survey) {
      None => trap(&format!("No survey with this name: {}.", survey)),
      Some(qs) => qs.clone(),
    }
  })
}

macro_rules! my_print {
    ($fmt:expr, $($args:expr),*) => {
        #[cfg(target_arch = "wasm32")]
        ic_cdk::print(format!($fmt, $($args),*));
        #[cfg(not(target_arch = "wasm32"))]
        println!($fmt, $($args),*);
    };
}

#[update]
fn add_survey(survey: Survey) {
  SURVEYS.with(|ref_cell| {
    my_print!("Survey added: {:?}", survey);
    let mut map = ref_cell.borrow_mut();
    map.insert(survey.name, survey.questions);
  });
}



thread_local! {
    static GREETING: RefCell<String> = RefCell::new(String::from("Hallo"));
}

#[query]
fn greet(name: String) -> String {
  GREETING.with(|greeting| format!("{}, {}!", (*greeting.borrow()).clone(), name))
}


#[update]
fn set_greeting(g: String) -> String {
  GREETING.with(|greeting| {
    let ret = format!("Greeting set to '{}'.", g);
    *greeting.borrow_mut() = g;
    ret
  })
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_survey() {
        let questions = vec![
          String::from("How old are you?"),
          String::from("How tall are you?"),
        ];
        let name = String::from("Personal info");
        let survey = Survey {
          name: name.clone(),
          questions: questions.clone(),
        };

        add_survey(survey.clone());
        assert_eq!(get_surveys(), vec![name.clone()]);
        assert_eq!(get_questions(name), questions);
    }
}
