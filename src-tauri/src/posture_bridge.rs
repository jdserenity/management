use serde::Deserialize;
use std::collections::VecDeque;

pub struct PostureDebouncer {
    turtle: VecDeque<bool>,
    shoulder: VecDeque<bool>,
    window: usize,
    threshold_count: usize,
}

impl PostureDebouncer {
    pub fn new() -> Self {
        Self {
            turtle: VecDeque::with_capacity(3),
            shoulder: VecDeque::with_capacity(3),
            window: 3,
            threshold_count: 2,
        }
    }

    pub fn set_frequency_level(&mut self, level: u8) {
        self.threshold_count = match level {
            1 => 1,
            3 => 3,
            _ => 2,
        };
    }

    pub fn clear(&mut self) {
        self.turtle.clear();
        self.shoulder.clear();
    }

    pub fn push(&mut self, raw_turtle: bool, raw_shoulder: bool) -> (bool, bool) {
        if self.turtle.len() >= self.window {
            self.turtle.pop_front();
        }
        self.turtle.push_back(raw_turtle);
        if self.shoulder.len() >= self.window {
            self.shoulder.pop_front();
        }
        self.shoulder.push_back(raw_shoulder);

        let turtle_final = self.turtle.iter().filter(|&&x| x).count() >= self.threshold_count;
        let shoulder_final = self.shoulder.iter().filter(|&&x| x).count() >= self.threshold_count;
        (turtle_final, shoulder_final)
    }
}

#[derive(Deserialize, Clone)]
pub struct PostureIngestPayload {
    pub turtle_neck: bool,
    pub shoulder_misalignment: bool,
    pub posture_score: f64,
    #[serde(default)]
    pub confidence: f32,
    #[serde(default)]
    pub metrics_json: Option<String>,
}

pub fn posture_recommendations(turtle: bool, shoulder: bool) -> Vec<String> {
    let mut recommendations = Vec::new();
    if turtle {
        recommendations.push("tip1".to_string());
        recommendations.push("tip2".to_string());
    }
    if shoulder {
        recommendations.push("tip4".to_string());
        recommendations.push("tip5".to_string());
    }
    if recommendations.is_empty() {
        recommendations.push("motivation.excellent".to_string());
    }
    recommendations
}
